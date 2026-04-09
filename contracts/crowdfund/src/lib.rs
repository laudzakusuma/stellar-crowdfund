#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    vec,
    Address, Env, String, Symbol,
    IntoVal,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Campaign,
    Donation(Address),
    RewardToken,
}

#[derive(Clone)]
#[contracttype]
pub struct Campaign {
    pub owner: Address,
    pub title: String,
    pub description: String,
    pub goal: i128,
    pub deadline: u64,
    pub raised: i128,
    pub withdrawn: bool,
}

const REWARD_RATIO: i128 = 10_0000000;
const STROOPS_PER_XLM: i128 = 10_000_000;

fn emit_donated(env: &Env, donor: &Address, amount: i128, reward: i128, total_raised: i128) {
    env.events().publish(
        (Symbol::new(env, "donated"), donor.clone()),
        (amount, reward, total_raised),
    );
}

fn emit_withdrawn(env: &Env, owner: &Address, amount: i128) {
    env.events().publish(
        (Symbol::new(env, "withdrawn"), owner.clone()),
        amount,
    );
}

fn emit_refunded(env: &Env, donor: &Address, amount: i128) {
    env.events().publish(
        (Symbol::new(env, "refunded"), donor.clone()),
        amount,
    );
}

fn emit_reward_minted(env: &Env, donor: &Address, reward: i128) {
    env.events().publish(
        (Symbol::new(env, "reward_minted"), donor.clone()),
        reward,
    );
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
        reward_token: Option<Address>,
    ) {
        if env.storage().instance().has(&DataKey::Campaign) {
            panic!("already initialized");
        }
        owner.require_auth();
        assert!(goal > 0, "goal must be positive");
        assert!(deadline > env.ledger().timestamp(), "deadline must be in the future");

        env.storage().instance().set(&DataKey::Campaign, &Campaign {
            owner,
            title,
            description,
            goal,
            deadline,
            raised: 0,
            withdrawn: false,
        });

        if let Some(token_addr) = reward_token {
            env.storage().instance().set(&DataKey::RewardToken, &token_addr);
        }
    }

    pub fn donate(env: Env, donor: Address, amount: i128) -> i128 {
        donor.require_auth();

        let mut campaign: Campaign =
            env.storage().instance().get(&DataKey::Campaign).unwrap();

        assert!(amount > 0, "amount must be positive");
        assert!(env.ledger().timestamp() <= campaign.deadline, "campaign has ended");
        assert!(!campaign.withdrawn, "campaign already completed");

        let prev: i128 = env.storage().persistent()
            .get(&DataKey::Donation(donor.clone()))
            .unwrap_or(0);
        env.storage().persistent()
            .set(&DataKey::Donation(donor.clone()), &(prev + amount));

        campaign.raised += amount;
        env.storage().instance().set(&DataKey::Campaign, &campaign);

        let reward_tokens = Self::compute_reward(amount);

        if let Some(token_addr) = env.storage().instance()
            .get::<DataKey, Address>(&DataKey::RewardToken)
        {
            env.invoke_contract::<()>(
                &token_addr,
                &Symbol::new(&env, "mint"),
                vec![
                    &env,
                    donor.clone().into_val(&env),
                    reward_tokens.into_val(&env),
                ],
            );
            emit_reward_minted(&env, &donor, reward_tokens);
        }

        emit_donated(&env, &donor, amount, reward_tokens, campaign.raised);
        campaign.raised
    }

    pub fn withdraw(env: Env) -> i128 {
        let mut campaign: Campaign =
            env.storage().instance().get(&DataKey::Campaign).unwrap();

        campaign.owner.require_auth();
        assert!(campaign.raised >= campaign.goal, "goal not reached");
        assert!(!campaign.withdrawn, "already withdrawn");

        campaign.withdrawn = true;
        env.storage().instance().set(&DataKey::Campaign, &campaign);

        emit_withdrawn(&env, &campaign.owner, campaign.raised);
        campaign.raised
    }

    pub fn refund(env: Env, donor: Address) -> i128 {
        donor.require_auth();

        let campaign: Campaign =
            env.storage().instance().get(&DataKey::Campaign).unwrap();

        assert!(env.ledger().timestamp() > campaign.deadline, "campaign still active");
        assert!(campaign.raised < campaign.goal, "goal was reached, no refund");

        let donation: i128 = env.storage().persistent()
            .get(&DataKey::Donation(donor.clone()))
            .unwrap_or(0);
        assert!(donation > 0, "no donation found");

        env.storage().persistent()
            .set(&DataKey::Donation(donor.clone()), &0_i128);

        emit_refunded(&env, &donor, donation);
        donation
    }

    pub fn get_campaign(env: Env) -> Campaign {
        env.storage().instance().get(&DataKey::Campaign).unwrap()
    }

    pub fn get_donation(env: Env, donor: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::Donation(donor))
            .unwrap_or(0)
    }

    pub fn get_progress(env: Env) -> u32 {
        let campaign: Campaign =
            env.storage().instance().get(&DataKey::Campaign).unwrap();
        if campaign.goal == 0 { return 0; }
        ((campaign.raised * 100) / campaign.goal).min(100) as u32
    }

    pub fn is_active(env: Env) -> bool {
        let campaign: Campaign =
            env.storage().instance().get(&DataKey::Campaign).unwrap();
        !campaign.withdrawn && env.ledger().timestamp() <= campaign.deadline
    }

    pub fn get_reward_token(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::RewardToken)
    }

    pub fn preview_reward(_env: Env, amount: i128) -> i128 {
        Self::compute_reward(amount)
    }

    fn compute_reward(amount_stroops: i128) -> i128 {
        (amount_stroops * REWARD_RATIO) / STROOPS_PER_XLM
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, testutils::Ledger, Env};

    fn create_campaign(env: &Env) -> (Address, CrowdfundContractClient) {
        let id = env.register_contract(None, CrowdfundContract);
        let client = CrowdfundContractClient::new(env, &id);
        let owner = Address::generate(env);
        let deadline = env.ledger().timestamp() + 86_400;

        client.initialize(
            &owner,
            &String::from_str(env, "Test Campaign"),
            &String::from_str(env, "A test crowdfund campaign"),
            &1_000_0000000_i128,
            &deadline,
            &None,
        );
        (owner, client)
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client) = create_campaign(&env);
        let c = client.get_campaign();
        assert_eq!(c.raised, 0);
        assert!(!c.withdrawn);
    }

    #[test]
    fn test_donate_updates_raised() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client) = create_campaign(&env);
        let donor = Address::generate(&env);
        let raised = client.donate(&donor, &100_0000000_i128);
        assert_eq!(raised, 100_0000000);
        assert_eq!(client.get_donation(&donor), 100_0000000);
    }

    #[test]
    fn test_reward_preview() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client) = create_campaign(&env);
        assert_eq!(client.preview_reward(&100_0000000_i128), 1_000_0000000);
    }

    #[test]
    fn test_progress() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client) = create_campaign(&env);
        let donor = Address::generate(&env);
        client.donate(&donor, &500_0000000_i128);
        assert_eq!(client.get_progress(), 50);
    }

    #[test]
    fn test_withdraw_when_goal_reached() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client) = create_campaign(&env);
        let donor = Address::generate(&env);
        client.donate(&donor, &1_000_0000000_i128);
        let w = client.withdraw();
        assert_eq!(w, 1_000_0000000);
    }

    #[test]
    #[should_panic(expected = "goal not reached")]
    fn test_withdraw_before_goal_panics() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client) = create_campaign(&env);
        let donor = Address::generate(&env);
        client.donate(&donor, &1_0000000_i128);
        client.withdraw();
    }

    #[test]
    fn test_refund_after_deadline() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client) = create_campaign(&env);
        let donor = Address::generate(&env);
        client.donate(&donor, &10_0000000_i128);

        env.ledger().with_mut(|l| { l.timestamp += 86_401; });

        let r = client.refund(&donor);
        assert_eq!(r, 10_0000000);
        assert_eq!(client.get_donation(&donor), 0);
    }

    #[test]
    fn test_multiple_donations_accumulate() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client) = create_campaign(&env);
        let donor = Address::generate(&env);
        client.donate(&donor, &50_0000000_i128);
        client.donate(&donor, &50_0000000_i128);
        assert_eq!(client.get_donation(&donor), 100_0000000);
    }

    #[test]
    fn test_is_active() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client) = create_campaign(&env);
        assert!(client.is_active());
        env.ledger().with_mut(|l| { l.timestamp += 86_401; });
        assert!(!client.is_active());
    }
}