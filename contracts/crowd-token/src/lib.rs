#![no_std]

//! CrowdToken — a minimal SEP-0041 compatible token.
//! Minting is restricted to the registered minter.
//! This contract is the target of an inter-contract call from Crowdfund.

use soroban_sdk::{
    contract, contractimpl, contracttype,
    token::Interface as TokenInterface,
    Address, Env, String,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Minter,
    Balance(Address),
    TotalSupply,
    Name,
    Symbol,
    Decimals,
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

        env.storage().instance().set(&DataKey::Admin,    &admin);
        env.storage().instance().set(&DataKey::Minter,   &minter);
        env.storage().instance().set(&DataKey::Decimals, &decimal);
        env.storage().instance().set(&DataKey::Name,     &name);
        env.storage().instance().set(&DataKey::Symbol,   &symbol);
        env.storage().instance().set(&DataKey::TotalSupply, &0_i128);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        assert!(amount > 0, "amount must be positive");

        let minter: Address = env.storage().instance().get(&DataKey::Minter).unwrap();
        minter.require_auth();

        let bal = Self::balance_of(&env, &to);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(bal + amount));

        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(supply + amount));

        env.events().publish(
            (soroban_sdk::symbol_short!("mint"), minter, to),
            amount,
        );
    }

    pub fn minter(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Minter).unwrap()
    }

    pub fn set_minter(env: Env, new_minter: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Minter, &new_minter);
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    fn balance_of(env: &Env, addr: &Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(addr.clone()))
            .unwrap_or(0)
    }
}

#[contractimpl]
impl TokenInterface for CrowdToken {
    fn allowance(env: Env, _from: Address, _spender: Address) -> i128 {
        0
    }

    fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        from.require_auth();
        env.events().publish(
            (soroban_sdk::symbol_short!("approve"), from, spender),
            (amount, expiration_ledger),
        );
    }

    fn balance(env: Env, id: Address) -> i128 {
        Self::balance_of(&env, &id)
    }

    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");

        let from_bal = Self::balance_of(&env, &from);
        assert!(from_bal >= amount, "insufficient balance");
        let to_bal = Self::balance_of(&env, &to);

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_bal - amount));
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_bal + amount));

        env.events().publish(
            (soroban_sdk::symbol_short!("transfer"), from, to),
            amount,
        );
    }

    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let from_bal = Self::balance_of(&env, &from);
        assert!(from_bal >= amount, "insufficient balance");
        let to_bal = Self::balance_of(&env, &to);

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_bal - amount));
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_bal + amount));

        env.events().publish(
            (soroban_sdk::symbol_short!("transfer"), from, to),
            amount,
        );
    }

    fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let bal = Self::balance_of(&env, &from);
        assert!(bal >= amount, "insufficient balance");
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(bal - amount));

        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(supply - amount));

        env.events().publish(
            (soroban_sdk::symbol_short!("burn"), from),
            amount,
        );
    }

    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        Self::burn(env, from, amount);
    }

    fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap_or(7)
    }

    fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or_else(|| String::from_str(&env, "Crowd Token"))
    }

    fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or_else(|| String::from_str(&env, "CROWD"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, CrowdTokenClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();

        let id = env.register_contract(None, CrowdToken);
        let client = CrowdTokenClient::new(&env, &id);

        let admin  = Address::generate(&env);
        let minter = Address::generate(&env);

        client.initialize(
            &admin,
            &minter,
            &7,
            &String::from_str(&env, "Crowd Token"),
            &String::from_str(&env, "CROWD"),
        );
        (env, client)
    }

    #[test]
    fn test_metadata() {
        let (env, c) = setup();
        assert_eq!(c.decimals(), 7);
        assert_eq!(c.name(),   String::from_str(&env, "Crowd Token"));
        assert_eq!(c.symbol(), String::from_str(&env, "CROWD"));
    }

    #[test]
    fn test_mint_and_balance() {
        let (env, c) = setup();
        let user = Address::generate(&env);
        c.mint(&user, &1_000_0000000_i128);
        assert_eq!(c.balance(&user), 1_000_0000000);
        assert_eq!(c.total_supply(), 1_000_0000000);
    }

    #[test]
    fn test_transfer() {
        let (env, c) = setup();
        let alice = Address::generate(&env);
        let bob   = Address::generate(&env);
        c.mint(&alice, &500_0000000_i128);
        c.transfer(&alice, &bob, &200_0000000_i128);
        assert_eq!(c.balance(&alice), 300_0000000);
        assert_eq!(c.balance(&bob),   200_0000000);
    }

    #[test]
    fn test_burn() {
        let (env, c) = setup();
        let alice = Address::generate(&env);
        c.mint(&alice, &100_0000000_i128);
        c.burn(&alice, &40_0000000_i128);
        assert_eq!(c.balance(&alice), 60_0000000);
        assert_eq!(c.total_supply(),  60_0000000);
    }

    #[test]
    fn test_zero_balance_default() {
        let (env, c) = setup();
        let nobody = Address::generate(&env);
        assert_eq!(c.balance(&nobody), 0);
    }
}