import { useEffect, useMemo, useState } from "react";
import { createWorker } from "tesseract.js";
import "./App.css";

const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Health",
  "Entertainment",
  "Education",
  "Other",
];

const CATEGORY_KEYWORDS = {
  Food: [
    "food",
    "restaurant",
    "lunch",
    "dinner",
    "breakfast",
    "grocery",
    "groceries",
    "coffee",
    "tea",
    "swiggy",
    "zomato",
  ],
  Transport: [
    "uber",
    "ola",
    "taxi",
    "bus",
    "train",
    "fuel",
    "petrol",
    "diesel",
    "parking",
    "metro",
  ],
  Shopping: [
    "shopping",
    "clothes",
    "shoes",
    "amazon",
    "flipkart",
    "mall",
  ],
  Bills: [
    "electricity",
    "water",
    "internet",
    "wifi",
    "phone",
    "mobile",
    "rent",
    "bill",
  ],
  Health: [
    "medicine",
    "doctor",
    "hospital",
    "pharmacy",
    "medical",
  ],
  Entertainment: [
    "movie",
    "cinema",
    "netflix",
    "spotify",
    "game",
  ],
  Education: ["book", "course", "school", "college", "education"],
};

function getLocalDate() {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000
  );

  return localDate.toISOString().slice(0, 10);
}

function getCurrentMonth() {
  return getLocalDate().slice(0, 7);
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function detectCategory(text) {
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(
    CATEGORY_KEYWORDS
  )) {
    if (keywords.some((keyword) => lowerText.includes(keyword))) {
      return category;
    }
  }

  return "Other";
}

function amountFromLine(line) {
  const match = line.match(
    /(?:₹|rs\.?|inr)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i
  );

  if (!match) {
    return "";
  }

  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : "";
}

function parseReceipt(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const totalLine = lines.find((line) =>
    /grand total|total amount|net total|amount payable|total/i.test(
      line
    )
  );

  let amount = totalLine ? amountFromLine(totalLine) : "";

  if (!amount) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const candidate = amountFromLine(lines[index]);

      if (candidate) {
        amount = candidate;
        break;
      }
    }
  }

  const description =
    lines.find(
      (line) =>
        line.length >= 3 &&
        line.length <= 60 &&
        !/\d{4,}/.test(line) &&
        !/total|tax|gst|invoice|receipt|date|phone|address/i.test(
          line
        )
    ) || "Receipt expense";

  const dateMatch = text.match(
    /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/
  );

  let date = getLocalDate();

  if (dateMatch) {
    const rawDate = dateMatch[1];

    if (rawDate.includes("-") && rawDate.indexOf("-") === 4) {
      const [year, month, day] = rawDate.split("-");

      date = [
        year,
        month.padStart(2, "0"),
        day.padStart(2, "0"),
      ].join("-");
    } else {
      const [dayPart, monthPart, yearPart] = rawDate.split(/[/-]/);
      let year = Number(yearPart);

      if (year < 100) {
        year += 2000;
      }

      date = [
        year,
        String(monthPart).padStart(2, "0"),
        String(dayPart).padStart(2, "0"),
      ].join("-");
    }
  }

  return {
    description,
    amount,
    category: detectCategory(text),
    date,
  };
}

function loadSavedTransactions() {
  try {
    const saved = localStorage.getItem("smart-expenses");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function App() {
  const [transactions, setTransactions] = useState(
    loadSavedTransactions
  );

  const [budget, setBudget] = useState(() => {
    return localStorage.getItem("monthly-budget") || "30000";
  });

  const [selectedMonth, setSelectedMonth] = useState(
    getCurrentMonth
  );
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const [transactionForm, setTransactionForm] = useState({
    description: "",
    amount: "",
    type: "expense",
    category: "Other",
    date: getLocalDate(),
  });

  const [receiptImage, setReceiptImage] = useState("");
  const [receiptForm, setReceiptForm] = useState(null);
  const [receiptText, setReceiptText] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [isReadingReceipt, setIsReadingReceipt] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      "smart-expenses",
      JSON.stringify(transactions)
    );
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem("monthly-budget", budget);
  }, [budget]);

  const monthTransactions = useMemo(
    () =>
      transactions.filter((item) =>
        item.date.startsWith(selectedMonth)
      ),
    [transactions, selectedMonth]
  );

  const visibleTransactions = useMemo(() => {
    return monthTransactions
      .filter((item) =>
        item.description.toLowerCase().includes(search.toLowerCase())
      )
      .filter(
        (item) => filterType === "all" || item.type === filterType
      )
      .filter(
        (item) =>
          filterCategory === "all" ||
          item.category === filterCategory
      )
      .sort((first, second) => second.date.localeCompare(first.date));
  }, [
    monthTransactions,
    search,
    filterType,
    filterCategory,
  ]);

  const income = monthTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const spending = monthTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const balance = income - spending;
  const budgetAmount = Number(budget) || 0;
  const budgetPercentage =
    budgetAmount > 0
      ? Math.min((spending / budgetAmount) * 100, 100)
      : 0;

  const categoryTotals = monthTransactions
    .filter((item) => item.type === "expense")
    .reduce((totals, item) => {
      totals[item.category] =
        (totals[item.category] || 0) + Number(item.amount);
      return totals;
    }, {});

  function handleTransactionChange(event) {
    const { name, value } = event.target;

    setTransactionForm((current) => {
      const updated = { ...current, [name]: value };

      if (name === "description" && current.type === "expense") {
        updated.category = detectCategory(value);
      }

      if (name === "type" && value === "income") {
        updated.category = "Income";
      } else if (name === "type" && value === "expense") {
        updated.category = "Other";
      }

      return updated;
    });
  }

  function addTransaction(event) {
    event.preventDefault();

    const amount = Number(transactionForm.amount);

    if (!transactionForm.description.trim()) {
      window.alert("Please enter a description.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Please enter an amount greater than zero.");
      return;
    }

    const newTransaction = {
      id: createId(),
      description: transactionForm.description.trim(),
      amount,
      type: transactionForm.type,
      category:
        transactionForm.type === "income"
          ? "Income"
          : transactionForm.category,
      date: transactionForm.date,
    };

    setTransactions((current) => [newTransaction, ...current]);

    setTransactionForm({
      description: "",
      amount: "",
      type: "expense",
      category: "Other",
      date: getLocalDate(),
    });
  }

  function deleteTransaction(id) {
    if (!window.confirm("Delete this transaction?")) {
      return;
    }

    setTransactions((current) =>
      current.filter((item) => item.id !== id)
    );
  }

  async function handleReceiptUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setReceiptError("Please choose an image file.");
      return;
    }

    if (receiptImage) {
      URL.revokeObjectURL(receiptImage);
    }

    setReceiptImage(URL.createObjectURL(file));
    setReceiptForm(null);
    setReceiptText("");
    setReceiptError("");
    setIsReadingReceipt(true);

    let worker;

    try {
      worker = await createWorker("eng");
      const result = await worker.recognize(file);
      const text = result.data.text;

      setReceiptText(text);
      setReceiptForm(parseReceipt(text));
    } catch (error) {
      setReceiptError(
        `Could not read the receipt: ${error.message}`
      );
    } finally {
      if (worker) {
        await worker.terminate();
      }

      setIsReadingReceipt(false);
    }
  }

  function updateReceiptField(field, value) {
    setReceiptForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function saveReceiptExpense() {
    const amount = Number(receiptForm?.amount);

    if (!receiptForm?.description.trim()) {
      window.alert("Please enter a description.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Please check the receipt amount.");
      return;
    }

    const newTransaction = {
      id: createId(),
      description: receiptForm.description.trim(),
      amount,
      type: "expense",
      category: receiptForm.category,
      date: receiptForm.date || getLocalDate(),
    };

    setTransactions((current) => [newTransaction, ...current]);
    setReceiptForm(null);
    setReceiptText("");
    setReceiptError("");

    if (receiptImage) {
      URL.revokeObjectURL(receiptImage);
      setReceiptImage("");
    }
  }

  function exportCsv() {
    if (visibleTransactions.length === 0) {
      window.alert("There are no transactions to export.");
      return;
    }

    const rows = [
      ["Description", "Amount", "Type", "Category", "Date"],
      ...visibleTransactions.map((item) => [
        item.description,
        item.amount,
        item.type,
        item.category,
        item.date,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value).replaceAll('"', '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = `expenses-${selectedMonth}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <div className="container">
        <header className="header">
          <div>
            <p className="eyebrow">SMART FINANCE</p>
            <h1>Expense Tracker</h1>
            <p className="subtitle">
              Track income, spending, and receipts in one place.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </header>

        <section className="summary-grid">
          <article className="summary-card income-card">
            <span>Income this month</span>
            <strong>{formatCurrency(income)}</strong>
          </article>

          <article className="summary-card expense-card">
            <span>Spending this month</span>
            <strong>{formatCurrency(spending)}</strong>
          </article>

          <article className="summary-card balance-card">
            <span>Balance this month</span>
            <strong>{formatCurrency(balance)}</strong>
          </article>
        </section>

        <section className="card">
          <h2>Add transaction</h2>
          <p className="hint">
            Enter an income or expense. The date defaults to today.
          </p>

          <form
            className="transaction-form"
            onSubmit={addTransaction}
          >
            <label>
              Description
              <input
                name="description"
                value={transactionForm.description}
                onChange={handleTransactionChange}
                placeholder="Example: Lunch at restaurant"
                required
              />
            </label>

            <label>
              Amount (₹)
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={transactionForm.amount}
                onChange={handleTransactionChange}
                placeholder="Example: 250"
                required
              />
            </label>

            <label>
              Transaction date
              <input
                name="date"
                type="date"
                value={transactionForm.date}
                onChange={handleTransactionChange}
                required
              />
            </label>

            <label>
              Transaction type
              <select
                name="type"
                value={transactionForm.type}
                onChange={handleTransactionChange}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>

            {transactionForm.type === "expense" && (
              <label>
                Category
                <select
                  name="category"
                  value={transactionForm.category}
                  onChange={handleTransactionChange}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button className="primary-button" type="submit">
              Add transaction
            </button>
          </form>
        </section>

        <section className="card receipt-card">
          <h2>Scan a receipt</h2>
          <p className="hint">
            Upload a clear receipt image. OCR suggests details for you
            to review before saving.
          </p>

          <label className="upload-button" htmlFor="receipt-upload">
            Choose receipt image
          </label>
          <input
            id="receipt-upload"
            type="file"
            accept="image/*"
            onChange={handleReceiptUpload}
            hidden
          />

          {receiptError && (
            <p className="error-message">{receiptError}</p>
          )}

          {receiptImage && (
            <img
              className="receipt-preview"
              src={receiptImage}
              alt="Receipt preview"
            />
          )}

          {isReadingReceipt && (
            <div className="reading-panel">
              <div className="spinner" />
              <p>Reading receipt…</p>
              <p className="hint">
                The first scan may take a little longer.
              </p>
            </div>
          )}

          {receiptForm && !isReadingReceipt && (
            <div className="receipt-review">
              <h3>Review detected details</h3>
              <p className="warning">
                OCR can make mistakes. Check every field before saving.
              </p>

              <label>
                Description / merchant
                <input
                  value={receiptForm.description}
                  onChange={(event) =>
                    updateReceiptField(
                      "description",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Amount (₹)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={receiptForm.amount}
                  onChange={(event) =>
                    updateReceiptField("amount", event.target.value)
                  }
                />
              </label>

              <label>
                Category
                <select
                  value={receiptForm.category}
                  onChange={(event) =>
                    updateReceiptField("category", event.target.value)
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={receiptForm.date}
                  onChange={(event) =>
                    updateReceiptField("date", event.target.value)
                  }
                />
              </label>

              <button
                className="primary-button"
                onClick={saveReceiptExpense}
              >
                Save receipt expense
              </button>
            </div>
          )}

          {receiptText && (
            <details className="raw-text">
              <summary>Show text detected from receipt</summary>
              <pre>{receiptText}</pre>
            </details>
          )}
        </section>

        <section className="card budget-card">
          <div className="section-heading">
            <div>
              <h2>Monthly budget</h2>
              <p>Spending: {formatCurrency(spending)}</p>
            </div>

            <label className="budget-label">
              Budget (₹)
              <input
                className="budget-input"
                type="number"
                min="0"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              />
            </label>
          </div>

          <div className="progress-track">
            <div
              className={
                spending > budgetAmount
                  ? "progress-bar progress-danger"
                  : "progress-bar"
              }
              style={{ width: `${budgetPercentage}%` }}
            />
          </div>

          <p className="budget-message">
            {spending > budgetAmount
              ? `${formatCurrency(spending - budgetAmount)} over budget`
              : `${formatCurrency(budgetAmount - spending)} remaining`}
          </p>

          <div className="category-list">
            {Object.entries(categoryTotals)
              .sort((first, second) => second[1] - first[1])
              .map(([category, amount]) => {
                const percent =
                  spending > 0 ? (amount / spending) * 100 : 0;

                return (
                  <div className="category-row" key={category}>
                    <div className="category-label">
                      <span>{category}</span>
                      <strong>{formatCurrency(amount)}</strong>
                    </div>
                    <div className="category-track">
                      <div
                        className="category-progress"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        <section className="card transactions-card">
          <div className="section-heading">
            <div>
              <h2>Transactions</h2>
              <p>{visibleTransactions.length} shown</p>
            </div>

            <label className="month-label">
              Month
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) =>
                  setSelectedMonth(event.target.value)
                }
              />
            </label>
          </div>

          <div className="filters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search description"
              aria-label="Search transactions"
            />

            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              aria-label="Filter by transaction type"
            >
              <option value="all">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>

            <select
              value={filterCategory}
              onChange={(event) =>
                setFilterCategory(event.target.value)
              }
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {visibleTransactions.length === 0 ? (
            <div className="empty-state">
              <h3>No transactions found</h3>
              <p>Add a transaction or change your filters.</p>
            </div>
          ) : (
            <div className="transaction-list">
              {visibleTransactions.map((item) => (
                <article className="transaction-row" key={item.id}>
                  <div>
                    <h3>{item.description}</h3>
                    <p>
                      {item.category} · {item.date}
                    </p>
                  </div>

                  <div className="transaction-actions">
                    <strong
                      className={
                        item.type === "income"
                          ? "income-text"
                          : "expense-text"
                      }
                    >
                      {item.type === "income" ? "+" : "-"}
                      {formatCurrency(item.amount)}
                    </strong>
                    <button
                      className="delete-button"
                      onClick={() => deleteTransaction(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="footer">
          Data is saved in this browser only. Receipt OCR is a
          suggestion; review it before saving. This app does not connect
          to your bank.
        </footer>
      </div>
    </main>
  );
}

export default App;