const BASE = "http://localhost:5000";

async function call(path, options = {}) {
  const res = await fetch(BASE + path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(path + ": " + (data.message || res.status));
  return data;
}

async function main() {
  // Make sure the test buyer exists (ignore "already exists")
  try {
    await call("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Buyer", email: "buyer@test.com", password: "123456" }),
    });
  } catch (e) {}

  const login = await call("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "buyer@test.com", password: "123456" }),
  });

  const products = await call("/api/products");
  const product = products.find((p) => p.stock > 0);
  if (!product) throw new Error("No product with stock. Add one in seller.html first.");

  const order = await call("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + login.token,
    },
    body: JSON.stringify({ items: [{ productId: product._id, quantity: 1 }] }),
  });

  console.log("Order placed:", order._id, "| product:", product.name, "| total:", order.total);
}

main().catch((err) => console.error("Failed:", err.message));