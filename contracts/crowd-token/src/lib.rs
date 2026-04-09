#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token::{self, Interface as _},
    Address, Env, String, Symbol,
};
use soroban_token_sdk::metadata::TokenMetadata;
use soroban_token_sdk::TokenUtils;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Minter,
    Balance(Address),
    Allowance(AllowanceKey),
}

#[derive(Clone)]
#[contracttype]
pub struct AllowanceKey {
    pub from: Address,
    pub spender: Address,
}


#[contract]
pub struct CrowdToken;

#[contractimpl]
impl CrowdToken {
    pub fn initialize(
        env: Env,
        admin: Address,
        minter: Address,
        decimal: u32,
        name: String,
        symbol: String,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();

        TokenUtils::new(&env)
            .metadata()
            .set_metadata(&TokenMetadata { decimal, name, symbol });

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Minter, &minter);
    }

    pub fn minter(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Minter).unwrap()
    }

    pub fn set_minter(env: Env, new_minter: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Minter, &new_minter);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let minter: Address = env.storage().instance().get(&DataKey::Minter).unwrap();
        minter.require_auth();

        assert!(amount > 0, "amount must be positive");

        let balance = Self::get_balance(&env, &to);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(balance + amount));
        TokenUtils::new(&env).events().mint(minter, to, amount);
    }

    fn get_balance(env: &Env, addr: &Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(addr.clone()))
            .unwrap_or(0)
    }
}

#[contractimpl]
impl token::Interface for CrowdToken {
    fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Allowance(AllowanceKey { from, spender }))
            .unwrap_or(0)
    }

    fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        let key = DataKey::Allowance(AllowanceKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        env.storage().persistent().set(&key, &amount);
        TokenUtils::new(&env)
            .events()
            .approve(from, spender, amount, expiration_ledger);
    }

    fn balance(env: Env, id: Address) -> i128 {
        Self::get_balance(&env, &id)
    }

    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");

        let from_balance = Self::get_balance(&env, &from);
        assert!(from_balance >= amount, "insufficient balance");

        let to_balance = Self::get_balance(&env, &to);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_balance - amount));
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_balance + amount));

        TokenUtils::new(&env).events().transfer(from, to, amount);
    }

    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();

        let allowance_key = DataKey::Allowance(AllowanceKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        let current: i128 = env
            .storage()
            .persistent()
            .get(&allowance_key)
            .unwrap_or(0);
        assert!(current >= amount, "insufficient allowance");

        env.storage()
            .persistent()
            .set(&allowance_key, &(current - amount));

        let from_balance = Self::get_balance(&env, &from);
        assert!(from_balance >= amount, "insufficient balance");
        let to_balance = Self::get_balance(&env, &to);

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_balance - amount));
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_balance + amount));

        TokenUtils::new(&env)
            .events()
            .transfer(from, to, amount);
    }

    fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let balance = Self::get_balance(&env, &from);
        assert!(balance >= amount, "insufficient balance");
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(balance - amount));
        TokenUtils::new(&env).events().burn(from, amount);
    }

    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        let allowance_key = DataKey::Allowance(AllowanceKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        let current: i128 = env
            .storage()
            .persistent()
            .get(&allowance_key)
            .unwrap_or(0);
        assert!(current >= amount, "insufficient allowance");
        env.storage()
            .persistent()
            .set(&allowance_key, &(current - amount));

        let balance = Self::get_balance(&env, &from);
        assert!(balance >= amount, "insufficient balance");
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(balance - amount));
        TokenUtils::new(&env).events().burn(from, amount);
    }

    fn decimals(env: Env) -> u32 {
        TokenUtils::new(&env).metadata().get_metadata().decimal
    }

    fn name(env: Env) -> String {
        TokenUtils::new(&env).metadata().get_metadata().name
    }

    fn symbol(env: Env) -> String {
        TokenUtils::new(&env).metadata().get_metadata().symbol
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, Address, Address, CrowdTokenClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, CrowdToken);
        let client = CrowdTokenClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let minter = Address::generate(&env);

        client.initialize(
            &admin,
            &minter,
            &7,
            &String::from_str(&env, "Crowd Token"),
            &String::from_str(&env, "CROWD"),
        );

        (env, admin, minter, client)
    }

    #[test]
    fn test_metadata() {
        let (_, _, _, client) = setup();
        assert_eq!(client.decimals(), 7);
        assert_eq!(client.name(), soroban_sdk::String::from_str(&client.env, "Crowd Token"));
        assert_eq!(client.symbol(), soroban_sdk::String::from_str(&client.env, "CROWD"));
    }

    #[test]
    fn test_mint_and_balance() {
        let (env, _, minter, client) = setup();
        let recipient = Address::generate(&env);
        client.mint(&recipient, &1_000_0000000);
        assert_eq!(client.balance(&recipient), 1_000_0000000);
    }

    #[test]
    fn test_transfer() {
        let (env, _, minter, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.mint(&alice, &500_0000000);
        client.transfer(&alice, &bob, &200_0000000);
        assert_eq!(client.balance(&alice), 300_0000000);
        assert_eq!(client.balance(&bob), 200_0000000);
    }

    #[test]
    fn test_burn() {
        let (env, _, _, client) = setup();
        let alice = Address::generate(&env);
        client.mint(&alice, &100_0000000);
        client.burn(&alice, &40_0000000);
        assert_eq!(client.balance(&alice), 60_0000000);
    }

    #[test]
    fn test_only_minter_can_mint() {
        let (env, _, _, client) = setup();
        let rando = Address::generate(&env);
        let result = std::panic::catch_unwind(|| {
            client.mint(&rando, &100);
        });
        assert_eq!(client.balance(&rando), 0);
    }
}