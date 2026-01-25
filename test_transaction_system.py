#!/usr/bin/env python3
"""
Transaction System Test Script for SafeTasks V3

This script tests the transaction implementation by:
1. Creating test bank accounts
2. Creating income and expense transactions
3. Verifying balance updates
4. Testing transaction deletion and rollback
5. Testing transaction filtering and search
6. Testing error handling

Usage: python test_transaction_system.py
"""

import asyncio
import json
import sys
import uuid
from datetime import date, datetime
from typing import Dict, List, Optional

import httpx

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api/v1"

# Test data
TEST_ORG_ID = uuid.UUID("2e252ec7-d5c7-4af3-97d2-77da17cc5219")  # From create_test_data.py
TEST_PROJECT_ID = uuid.UUID("3f1a5b8c-9d4e-4f7a-8b2c-6e5d3a1f9c8b")  # Will be created if needed

# Test bank account data
BANK_ACCOUNT_DATA = {
    "name": "Test Checking Account",
    "account_number": "12345678",
    "bank_name": "Test Bank",
    "currency": "BRL",
    "account_type": "checking",
    "is_active": True
}

# Test transaction data
INCOME_TRANSACTION = {
    "description": "Production Revenue - Coca-Cola Campaign",
    "amount_cents": 15000000,  # R$ 150,000.00
    "type": "income",
    "category": "production_revenue",
    "transaction_date": date.today().isoformat(),
    "notes": "Payment for summer campaign production"
}

EXPENSE_TRANSACTION = {
    "description": "Crew Hire - Camera Team",
    "amount_cents": 5000000,  # R$ 50,000.00
    "type": "expense",
    "category": "crew_hire",
    "transaction_date": date.today().isoformat(),
    "notes": "Camera crew for 3-day shoot"
}


class TransactionTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.bank_account_id = None
        self.income_transaction_id = None
        self.expense_transaction_id = None
        self.test_results = []

    async def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    async def create_bank_account(self) -> Optional[Dict]:
        """Create a test bank account"""
        try:
            response = await self.client.post(
                f"{API_BASE}/bank-accounts/",
                json=BANK_ACCOUNT_DATA
            )
            if response.status_code == 200:
                account = response.json()
                self.bank_account_id = account["id"]
                await self.log_test("Create Bank Account", True, f"ID: {self.bank_account_id}")
                return account
            else:
                await self.log_test("Create Bank Account", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            await self.log_test("Create Bank Account", False, f"Exception: {str(e)}")
            return None

    async def get_bank_account(self, account_id: str) -> Optional[Dict]:
        """Get bank account details"""
        try:
            response = await self.client.get(f"{API_BASE}/bank-accounts/{account_id}")
            if response.status_code == 200:
                return response.json()
            else:
                return None
        except Exception:
            return None

    async def create_transaction(self, transaction_data: Dict, account_id: str) -> Optional[Dict]:
        """Create a transaction"""
        try:
            # Add bank_account_id to transaction data
            transaction_with_account = {**transaction_data, "bank_account_id": account_id}
            
            response = await self.client.post(
                f"{API_BASE}/transactions/",
                json=transaction_with_account
            )
            
            if response.status_code == 200:
                transaction = response.json()
                return transaction
            else:
                print(f"Failed to create transaction: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Exception creating transaction: {str(e)}")
            return None

    async def test_transaction_creation(self) -> bool:
        """Test creating income and expense transactions"""
        if not self.bank_account_id:
            await self.log_test("Transaction Creation", False, "No bank account available")
            return False

        # Test income transaction
        income_transaction = await self.create_transaction(INCOME_TRANSACTION, self.bank_account_id)
        if income_transaction:
            self.income_transaction_id = income_transaction["id"]
            await self.log_test("Create Income Transaction", True, f"ID: {self.income_transaction_id}")
        else:
            await self.log_test("Create Income Transaction", False, "Failed to create")
            return False

        # Test expense transaction
        expense_transaction = await self.create_transaction(EXPENSE_TRANSACTION, self.bank_account_id)
        if expense_transaction:
            self.expense_transaction_id = expense_transaction["id"]
            await self.log_test("Create Expense Transaction", True, f"ID: {self.expense_transaction_id}")
        else:
            await self.log_test("Create Expense Transaction", False, "Failed to create")
            return False

        return True

    async def test_balance_updates(self) -> bool:
        """Test that bank account balances are updated correctly"""
        if not self.bank_account_id:
            await self.log_test("Balance Updates", False, "No bank account available")
            return False

        # Get initial balance
        account = await self.get_bank_account(self.bank_account_id)
        if not account:
            await self.log_test("Balance Updates", False, "Cannot get account details")
            return False

        initial_balance = account["balance_cents"]
        print(f"Initial balance: R$ {initial_balance / 100:.2f}")

        # Expected balance: initial + income - expense
        expected_balance = initial_balance + INCOME_TRANSACTION["amount_cents"] - EXPENSE_TRANSACTION["amount_cents"]
        
        # Get updated balance
        account = await self.get_bank_account(self.bank_account_id)
        if not account:
            await self.log_test("Balance Updates", False, "Cannot get updated account details")
            return False

        final_balance = account["balance_cents"]
        print(f"Final balance: R$ {final_balance / 100:.2f}")
        print(f"Expected balance: R$ {expected_balance / 100:.2f}")

        if final_balance == expected_balance:
            await self.log_test("Balance Updates", True, f"Balance correctly updated")
            return True
        else:
            await self.log_test("Balance Updates", False, f"Expected {expected_balance}, got {final_balance}")
            return False

    async def test_transaction_retrieval(self) -> bool:
        """Test retrieving individual transactions"""
        success = True

        # Test income transaction retrieval
        if self.income_transaction_id:
            try:
                response = await self.client.get(f"{API_BASE}/transactions/{self.income_transaction_id}")
                if response.status_code == 200:
                    transaction = response.json()
                    if transaction["type"] == "income" and transaction["amount_cents"] == INCOME_TRANSACTION["amount_cents"]:
                        await self.log_test("Retrieve Income Transaction", True)
                    else:
                        await self.log_test("Retrieve Income Transaction", False, "Data mismatch")
                        success = False
                else:
                    await self.log_test("Retrieve Income Transaction", False, f"Status: {response.status_code}")
                    success = False
            except Exception as e:
                await self.log_test("Retrieve Income Transaction", False, f"Exception: {str(e)}")
                success = False

        # Test expense transaction retrieval
        if self.expense_transaction_id:
            try:
                response = await self.client.get(f"{API_BASE}/transactions/{self.expense_transaction_id}")
                if response.status_code == 200:
                    transaction = response.json()
                    if transaction["type"] == "expense" and transaction["amount_cents"] == EXPENSE_TRANSACTION["amount_cents"]:
                        await self.log_test("Retrieve Expense Transaction", True)
                    else:
                        await self.log_test("Retrieve Expense Transaction", False, "Data mismatch")
                        success = False
                else:
                    await self.log_test("Retrieve Expense Transaction", False, f"Status: {response.status_code}")
                    success = False
            except Exception as e:
                await self.log_test("Retrieve Expense Transaction", False, f"Exception: {str(e)}")
                success = False

        return success

    async def test_transaction_deletion(self) -> bool:
        """Test deleting transactions and balance rollback"""
        if not self.bank_account_id:
            await self.log_test("Transaction Deletion", False, "No bank account available")
            return False

        # Get balance before deletion
        account = await self.get_bank_account(self.bank_account_id)
        if not account:
            await self.log_test("Transaction Deletion", False, "Cannot get account details")
            return False

        balance_before = account["balance_cents"]

        # Delete expense transaction
        if self.expense_transaction_id:
            try:
                response = await self.client.delete(f"{API_BASE}/transactions/{self.expense_transaction_id}")
                if response.status_code == 200:
                    await self.log_test("Delete Expense Transaction", True)
                else:
                    await self.log_test("Delete Expense Transaction", False, f"Status: {response.status_code}")
                    return False
            except Exception as e:
                await self.log_test("Delete Expense Transaction", False, f"Exception: {str(e)}")
                return False

        # Check balance rollback
        account = await self.get_bank_account(self.bank_account_id)
        if not account:
            await self.log_test("Transaction Deletion", False, "Cannot get updated account details")
            return False

        balance_after = account["balance_cents"]
        expected_balance = balance_before + EXPENSE_TRANSACTION["amount_cents"]  # Expense was deleted, so balance should increase

        if balance_after == expected_balance:
            await self.log_test("Balance Rollback", True, f"Balance correctly rolled back")
            return True
        else:
            await self.log_test("Balance Rollback", False, f"Expected {expected_balance}, got {balance_after}")
            return False

    async def test_transaction_filtering(self) -> bool:
        """Test transaction filtering by type"""
        if not self.bank_account_id:
            await self.log_test("Transaction Filtering", False, "No bank account available")
            return False

        success = True

        # Test filtering by income
        try:
            response = await self.client.get(f"{API_BASE}/transactions?type=income")
            if response.status_code == 200:
                transactions = response.json()
                income_transactions = [t for t in transactions if t["type"] == "income"]
                if len(income_transactions) > 0:
                    await self.log_test("Filter by Income", True, f"Found {len(income_transactions)} income transactions")
                else:
                    await self.log_test("Filter by Income", False, "No income transactions found")
                    success = False
            else:
                await self.log_test("Filter by Income", False, f"Status: {response.status_code}")
                success = False
        except Exception as e:
            await self.log_test("Filter by Income", False, f"Exception: {str(e)}")
            success = False

        # Test filtering by expense
        try:
            response = await self.client.get(f"{API_BASE}/transactions?type=expense")
            if response.status_code == 200:
                transactions = response.json()
                expense_transactions = [t for t in transactions if t["type"] == "expense"]
                if len(expense_transactions) > 0:
                    await self.log_test("Filter by Expense", True, f"Found {len(expense_transactions)} expense transactions")
                else:
                    await self.log_test("Filter by Expense", False, "No expense transactions found")
                    success = False
            else:
                await self.log_test("Filter by Expense", False, f"Status: {response.status_code}")
                success = False
        except Exception as e:
            await self.log_test("Filter by Expense", False, f"Exception: {str(e)}")
            success = False

        return success

    async def test_monthly_stats(self) -> bool:
        """Test monthly financial statistics"""
        try:
            current_year = date.today().year
            current_month = date.today().month
            
            response = await self.client.get(
                f"{API_BASE}/transactions/stats/monthly?year={current_year}&month={current_month}"
            )
            
            if response.status_code == 200:
                stats = response.json()
                await self.log_test("Monthly Stats", True, f"Year: {stats['year']}, Month: {stats['month']}")
                return True
            else:
                await self.log_test("Monthly Stats", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            await self.log_test("Monthly Stats", False, f"Exception: {str(e)}")
            return False

    async def run_all_tests(self):
        """Run all tests"""
        print("🧪 Starting Transaction System Tests")
        print("=" * 50)

        # Test 1: Create bank account
        await self.create_bank_account()

        # Test 2: Create transactions
        if self.bank_account_id:
            await self.test_transaction_creation()

        # Test 3: Verify balance updates
        if self.income_transaction_id and self.expense_transaction_id:
            await self.test_balance_updates()

        # Test 4: Retrieve transactions
        await self.test_transaction_retrieval()

        # Test 5: Delete transaction and verify rollback
        if self.expense_transaction_id:
            await self.test_transaction_deletion()

        # Test 6: Test filtering
        await self.test_transaction_filtering()

        # Test 7: Test monthly stats
        await self.test_monthly_stats()

        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)

        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests

        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")

        if failed_tests > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")

        # Save test results
        with open("transaction_test_results.json", "w") as f:
            json.dump(self.test_results, f, indent=2)

        print(f"\n📄 Test results saved to: transaction_test_results.json")
        return failed_tests == 0


async def main():
    """Main test runner"""
    tester = TransactionTester()
    
    try:
        success = await tester.run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)
    finally:
        await tester.client.aclose()


if __name__ == "__main__":
    asyncio.run(main())