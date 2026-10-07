const express = require("express");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const logAction = require("../utils/audit");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// Overview numbers (admin only)
router.get("/stats", protect, authorize("admin"), async (req, res) => {
  try {
    const [buyers, sellers, admins, products, orders, sales] = await Promise.all([
      User.countDocuments({ role: "buyer" }),
      User.countDocuments({ role: "seller" }),
      User.countDocuments({ role: "admin" }),
      Product.countDocuments(),
      Order.countDocuments(),
      // Cancelled orders are not counted as sales
      Order.aggregate([
        { $match: { status: { $nin: ["Cancelled", "cancelled"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);
    res.json({
      buyers,
      sellers,
      admins,
      products,
      orders,
      totalSales: sales.length ? sales[0].total : 0,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// List all users (admin only)
router.get("/", protect, authorize("admin"), async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// Change a user's role (admin only)
router.put("/:id/role", protect, authorize("admin"), async (req, res) => {
  try {
    const { role } = req.body;
    if (!["buyer", "seller", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    if (req.params.id === String(req.user.id)) {
      return res.status(400).json({ message: "You cannot change your own role." });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });

    const oldRole = target.role;
    target.role = role;
    await target.save();

    await logAction(
      req,
      "Changed user role",
      target.name + " (" + target.email + "): " + oldRole + " to " + role
    );

    res.json({ _id: target._id, name: target.name, email: target.email, role: target.role });
  } catch (err) {
    res.status(400).json({ message: "Invalid ID." });
  }
});

// Remove a user (admin only)
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.role === "admin") {
      return res.status(400).json({ message: "Admin accounts cannot be removed here." });
    }

    await Product.deleteMany({ seller: user._id });
    await user.deleteOne();

    await logAction(
      req,
      "Removed user",
      user.name + " (" + user.email + "), role: " + user.role
    );

    res.json({ message: "User removed." });
  } catch (err) {
    res.status(400).json({ message: "Invalid ID." });
  }
});

module.exports = router;