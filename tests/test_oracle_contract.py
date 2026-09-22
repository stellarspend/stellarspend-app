from pathlib import Path

ROOT = Path(__file__).parents[1]


def source(name):
    return (ROOT / name).read_text()


def test_oracle_reads_contract_and_marks_stale_rates():
    text = source("lib/stellar/priceOracle.ts")
    assert '"get_rate"' in text
    assert "maxAgeMs" in text
    assert "stale" in text


def test_balances_have_no_mock_usd_values_and_use_oracle_conversion():
    text = source("lib/api/client.ts")
    assert "MOCK_BALANCES" not in text
    assert "oracle.convert" in text


def test_ui_surfaces_delayed_rate_and_budget_uses_target_asset():
    widget = source("components/dashboard/BalancesWidget.tsx")
    budget = source("components/budgets/BudgetForm.tsx")
    assert "Rates may be delayed" in widget
    assert "rate.stale" in widget
    assert "oracle.convert" in budget
    assert "budgetAsset" in budget
