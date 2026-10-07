require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const users = [
      { name: "Test Seller", email: "seller@test.com", password: "123456", role: "seller" },
      { name: "Test Admin", email: "admin@test.com", password: "123456", role: "admin" },
    ];

    for (const u of users) {
      await User.deleteOne({ email: u.email });
      await User.create({ ...u, password: await bcrypt.hash(u.password, 10) });
      console.log("Created:", u.email, "-", u.role);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
  process.exit();
})();