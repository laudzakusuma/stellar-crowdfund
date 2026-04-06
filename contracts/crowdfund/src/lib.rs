#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, log, symbol_short, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug)]
pub struct Campaign {
    pub owner: Address,
    pub title: String,
    pub description: String,
    pub goal: i128,
    pub raised: i128,
    pub deadline: u64,
    pub withdrawn: bool,
    pub donor_count: u32,
}

#[contracttype]
pub enum DataKey {
    Campaign,
    Donor(Address),
}


#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    pub fn initialize(
        env: Env,
        owner: Address,
        title: String,
        description: String,
        goal: i128,
        deadline: u64,
    ) {
        owner.require_auth();
        if env.storage().instance().has(&DataKey::Campaign) {
            panic!("Campaign already initialized");
        }
        if goal <= 0 {
            panic!("Goal must be positive");
        }
        if deadline <= env.ledger().timestamp() {
            panic!("Deadline must be in the future");
        }
        let campaign = Campaign {
            owner,
            title,
            description,
            goal,
            raised: 0,
            deadline,
            withdrawn: false,
            donor_count: 0,
        };
        env.storage().instance().set(&DataKey::Campaign, &campaign);
        env.storage().instance().extend_ttl(200_000, 200_000);
        env.events()
            .publish((symbol_short!("init"),), (campaign.goal, campaign.deadline));
        log!(&env, "Campaign initialized: goal={}", goal);
    }

    pub fn donate(env: Env, donor: Address, amount: i128) {
        donor.require_auth();
        if amount <= 0 {
            panic!("Amount must be positive");
        }
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("Campaign not initialized");
        if env.ledger().timestamp() >= campaign.deadline {
            panic!("Campaign has ended");
        }
        campaign.raised += amount;
        let prev: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Donor(donor.clone()))
            .unwrap_or(0);
        if prev == 0 {
            campaign.donor_count += 1;
        }
        env.storage()
            .instance()
            .set(&DataKey::Donor(donor.clone()), &(prev + amount));
        env.storage().instance().set(&DataKey::Campaign, &campaign);
        env.storage().instance().extend_ttl(200_000, 200_000);
        env.events().publish(
            (symbol_short!("donated"), donor.clone()),
            (amount, campaign.raised, campaign.donor_count),
        );
        log!(&env, "Donation {} from {} | total {}", amount, donor, campaign.raised);
    }

    pub fn withdraw(env: Env) {
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("Campaign not initialized");
        campaign.owner.require_auth();
        if campaign.withdrawn {
            panic!("Funds already withdrawn");
        }
        if campaign.raised < campaign.goal {
            panic!("Goal not yet reached");
        }
        campaign.withdrawn = true;
        env.storage().instance().set(&DataKey::Campaign, &campaign);
        env.events().publish(
            (symbol_short!("withdraw"),),
            (campaign.raised, campaign.owner.clone()),
        );
        log!(&env, "Withdrew {} stroops", campaign.raised);
    }

    pub fn refund(env: Env, donor: Address) {
        donor.require_auth();
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("Campaign not initialized");
        if env.ledger().timestamp() < campaign.deadline {
            panic!("Campaign still active");
        }
        if campaign.raised >= campaign.goal {
            panic!("Goal reached, no refunds");
        }
        let donated: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Donor(donor.clone()))
            .unwrap_or(0);
        if donated == 0 {
            panic!("No donation found");
        }
        env.storage()
            .instance()
            .set(&DataKey::Donor(donor.clone()), &0i128);
        env.events().publish((symbol_short!("refund"), donor.clone()), donated);
        log!(&env, "Refund {} to {}", donated, donor);
    }

    pub fn get_campaign(env: Env) -> Campaign {
        env.storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("Campaign not initialized")
    }

    pub fn get_donation(env: Env, donor: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Donor(donor))
            .unwrap_or(0)
    }

    pub fn get_progress(env: Env) -> u32 {
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("Campaign not initialized");
        if campaign.goal == 0 { return 0; }
        let pct = (campaign.raised * 100) / campaign.goal;
        if pct > 100 { 100 } else { pct as u32 }
    }

    pub fn is_active(env: Env) -> bool {
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("Campaign not initialized");
        env.ledger().timestamp() < campaign.deadline && !campaign.withdrawn
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Env, String};

    fn setup() -> (Env, Address, CrowdfundContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, CrowdfundContract);
        let client = CrowdfundContractClient::new(&env, &id);
        let owner = Address::generate(&env);
        (env, owner, client)
    }

    fn init(env: &Env, owner: &Address, client: &CrowdfundContractClient, goal: i128, days: u64) {
        let deadline = env.ledger().timestamp() + days * 86400;
        client.initialize(
            owner,
            &String::from_str(env, "Save the Ocean"),
            &String::from_str(env, "Ocean cleanup initiative"),
            &goal,
            &deadline,
        );
    }

    #[test]
    fn test_initialize_sets_correct_state() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 100_000_000, 30);
        let c = client.get_campaign();
        assert_eq!(c.raised, 0, "Raised should start at 0");
        assert_eq!(c.goal, 100_000_000);
        assert!(!c.withdrawn, "Should not be withdrawn at start");
        assert_eq!(c.donor_count, 0);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize_panics() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 100_000_000, 30);
        init(&env, &owner, &client, 200_000_000, 30);
    }

    #[test]
    fn test_single_donation_tracked_correctly() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 100_000_000, 30);
        let donor = Address::generate(&env);
        client.donate(&donor, &25_000_000);
        let c = client.get_campaign();
        assert_eq!(c.raised, 25_000_000, "Raised should match donation");
        assert_eq!(c.donor_count, 1, "Donor count should be 1");
        assert_eq!(client.get_donation(&donor), 25_000_000);
    }

    #[test]
    fn test_multiple_donations_from_same_donor_accumulate() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 100_000_000, 30);
        let donor = Address::generate(&env);
        client.donate(&donor, &10_000_000);
        client.donate(&donor, &15_000_000);
        client.donate(&donor, &5_000_000);
        let c = client.get_campaign();
        assert_eq!(c.raised, 30_000_000, "Total should be sum of all donations");
        assert_eq!(c.donor_count, 1, "Same donor should count as 1");
        assert_eq!(client.get_donation(&donor), 30_000_000);
    }

    #[test]
    fn test_multiple_donors_tracked_separately() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 100_000_000, 30);
        let donor_a = Address::generate(&env);
        let donor_b = Address::generate(&env);
        let donor_c = Address::generate(&env);
        client.donate(&donor_a, &10_000_000);
        client.donate(&donor_b, &20_000_000);
        client.donate(&donor_c, &30_000_000);
        let c = client.get_campaign();
        assert_eq!(c.raised, 60_000_000);
        assert_eq!(c.donor_count, 3);
        assert_eq!(client.get_donation(&donor_a), 10_000_000);
        assert_eq!(client.get_donation(&donor_b), 20_000_000);
        assert_eq!(client.get_donation(&donor_c), 30_000_000);
    }

    #[test]
    fn test_progress_percentage_is_correct() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 100_000_000, 30);
        let donor = Address::generate(&env);
        assert_eq!(client.get_progress(), 0, "Progress starts at 0");
        client.donate(&donor, &25_000_000);
        assert_eq!(client.get_progress(), 25, "25% after 25M/100M");
        client.donate(&donor, &25_000_000);
        assert_eq!(client.get_progress(), 50, "50% after 50M/100M");
        client.donate(&donor, &50_000_000);
        assert_eq!(client.get_progress(), 100, "100% when goal reached");
    }

    #[test]
    fn test_progress_capped_at_100_when_over_goal() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 50_000_000, 30);
        let donor = Address::generate(&env);
        client.donate(&donor, &200_000_000);
        assert_eq!(client.get_progress(), 100, "Progress should cap at 100");
    }

    #[test]
    fn test_withdraw_succeeds_when_goal_reached() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 50_000_000, 30);
        let donor = Address::generate(&env);
        client.donate(&donor, &50_000_000);
        client.withdraw();
        assert!(client.get_campaign().withdrawn, "Should be marked withdrawn");
    }

    #[test]
    #[should_panic(expected = "Goal not yet reached")]
    fn test_withdraw_panics_if_goal_not_met() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 100_000_000, 30);
        let donor = Address::generate(&env);
        client.donate(&donor, &10_000_000);
        client.withdraw();
    }

    #[test]
    #[should_panic(expected = "already withdrawn")]
    fn test_double_withdraw_panics() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 50_000_000, 30);
        let donor = Address::generate(&env);
        client.donate(&donor, &50_000_000);
        client.withdraw();
        client.withdraw();
    }

    #[test]
    #[should_panic(expected = "Campaign has ended")]
    fn test_donate_after_deadline_panics() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 100_000_000, 1);
        // Advance ledger past deadline
        env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: env.ledger().timestamp() + 2 * 86400,
            protocol_version: 21,
            sequence_number: env.ledger().sequence(),
            network_id: Default::default(),
            base_reserve: 10,
            min_persistent_entry_ttl: 4096,
            min_temp_entry_ttl: 16,
            max_entry_ttl: 3110400,
        });
        let donor = Address::generate(&env);
        client.donate(&donor, &10_000_000);
    }

    #[test]
    fn test_is_active_reflects_campaign_state() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 50_000_000, 30);
        assert!(client.is_active(), "Should be active initially");
        let donor = Address::generate(&env);
        client.donate(&donor, &50_000_000);
        client.withdraw();
        assert!(!client.is_active(), "Should be inactive after withdrawal");
    }

    #[test]
    #[should_panic(expected = "Amount must be positive")]
    fn test_zero_donation_panics() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 100_000_000, 30);
        let donor = Address::generate(&env);
        client.donate(&donor, &0);
    }

    #[test]
    #[should_panic(expected = "Goal must be positive")]
    fn test_negative_goal_panics() {
        let (env, owner, client) = setup();
        let deadline = env.ledger().timestamp() + 86400;
        client.initialize(
            &owner,
            &String::from_str(&env, "Bad"),
            &String::from_str(&env, "Bad"),
            &-1,
            &deadline,
        );
    }

    #[test]
    fn test_get_donation_returns_zero_for_unknown_donor() {
        let (env, owner, client) = setup();
        init(&env, &owner, &client, 100_000_000, 30);
        let stranger = Address::generate(&env);
        assert_eq!(client.get_donation(&stranger), 0, "Unknown donor should have 0");
    }
}