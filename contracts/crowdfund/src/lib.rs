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
    DonorList(u32),
    DonorCount,
}

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    CampaignEnded = 3,
    CampaignActive = 4,
    GoalNotReached = 5,
    AlreadyWithdrawn = 6,
    InvalidAmount = 7,
    Unauthorized = 8,
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
        env.events().publish(
            (symbol_short!("init"),),
            (campaign.goal, campaign.deadline),
        );

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
        let prev_donation: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Donor(donor.clone()))
            .unwrap_or(0);
        if prev_donation == 0 {
            campaign.donor_count += 1;
        }

        env.storage()
            .instance()
            .set(&DataKey::Donor(donor.clone()), &(prev_donation + amount));

        env.storage().instance().set(&DataKey::Campaign, &campaign);
        env.storage().instance().extend_ttl(200_000, 200_000);
        env.events().publish(
            (symbol_short!("donated"), donor.clone()),
            (amount, campaign.raised, campaign.donor_count),
        );

        log!(
            &env,
            "Donation: {} stroops from {} | Total raised: {}",
            amount,
            donor,
            campaign.raised
        );
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

        log!(&env, "Funds withdrawn: {} stroops", campaign.raised);
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

        env.events().publish(
            (symbol_short!("refund"), donor.clone()),
            donated,
        );

        log!(&env, "Refund: {} stroops to {}", donated, donor);
    }
    pub fn get_campaign(env: Env) -> Campaign {
        env.storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("Campaign not initialized")
    }

    /// Get donation amount for a specific address
    pub fn get_donation(env: Env, donor: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Donor(donor))
            .unwrap_or(0)
    }

    /// Get progress percentage (0–100)
    pub fn get_progress(env: Env) -> u32 {
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("Campaign not initialized");

        if campaign.goal == 0 {
            return 0;
        }

        let pct = (campaign.raised * 100) / campaign.goal;
        if pct > 100 {
            100
        } else {
            pct as u32
        }
    }

    /// Check if campaign is still active
    pub fn is_active(env: Env) -> bool {
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("Campaign not initialized");

        env.ledger().timestamp() < campaign.deadline && !campaign.withdrawn
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    fn create_env() -> (Env, Address, CrowdfundContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, CrowdfundContract);
        let client = CrowdfundContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        (env, owner, client)
    }

    #[test]
    fn test_initialize() {
        let (env, owner, client) = create_env();
        let deadline = env.ledger().timestamp() + 86400;

        client.initialize(
            &owner,
            &String::from_str(&env, "Save the Ocean"),
            &String::from_str(&env, "Crowdfund for ocean cleanup"),
            &10_000_000_0i128,
            &deadline,
        );

        let campaign = client.get_campaign();
        assert_eq!(campaign.raised, 0);
        assert_eq!(campaign.goal, 10_000_000_0);
        assert!(!campaign.withdrawn);
    }

    #[test]
    fn test_donate() {
        let (env, owner, client) = create_env();
        let deadline = env.ledger().timestamp() + 86400;
        let donor = Address::generate(&env);

        client.initialize(
            &owner,
            &String::from_str(&env, "Save the Ocean"),
            &String::from_str(&env, "Crowdfund for ocean cleanup"),
            &100_000_000i128,
            &deadline,
        );

        client.donate(&donor, &50_000_000i128);

        let campaign = client.get_campaign();
        assert_eq!(campaign.raised, 50_000_000);
        assert_eq!(campaign.donor_count, 1);
        assert_eq!(client.get_donation(&donor), 50_000_000);
    }

    #[test]
    fn test_progress() {
        let (env, owner, client) = create_env();
        let deadline = env.ledger().timestamp() + 86400;
        let donor = Address::generate(&env);

        client.initialize(
            &owner,
            &String::from_str(&env, "Test"),
            &String::from_str(&env, "Test desc"),
            &100_000_000i128,
            &deadline,
        );

        client.donate(&donor, &25_000_000i128);
        assert_eq!(client.get_progress(), 25);
    }

    #[test]
    fn test_withdraw_when_goal_reached() {
        let (env, owner, client) = create_env();
        let deadline = env.ledger().timestamp() + 86400;
        let donor = Address::generate(&env);

        client.initialize(
            &owner,
            &String::from_str(&env, "Test"),
            &String::from_str(&env, "Test desc"),
            &50_000_000i128,
            &deadline,
        );

        client.donate(&donor, &50_000_000i128);
        client.withdraw();

        let campaign = client.get_campaign();
        assert!(campaign.withdrawn);
    }

    #[test]
    #[should_panic(expected = "Goal not yet reached")]
    fn test_withdraw_fails_when_goal_not_reached() {
        let (env, owner, client) = create_env();
        let deadline = env.ledger().timestamp() + 86400;
        let donor = Address::generate(&env);

        client.initialize(
            &owner,
            &String::from_str(&env, "Test"),
            &String::from_str(&env, "Test desc"),
            &100_000_000i128,
            &deadline,
        );

        client.donate(&donor, &10_000_000i128);
        client.withdraw(); // should panic
    }
}
