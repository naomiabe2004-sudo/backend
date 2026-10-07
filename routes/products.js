const express = require("express");
const Product = require("../models/Product");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// All products (public)
router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
      .populate("seller", "name")
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// Products of the logged-in seller
router.get("/mine", protect, authorize("seller", "admin"), async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user.id }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// Single product
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("seller", "name");
    if (!product) return res.status(404).json({ message: "Product not found." });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "Invalid ID." });
  }
});

// Create a product (seller or admin only)
router.post("/", protect, authorize("seller", "admin"), async (req, res) => {
  try {
    const { name, description, price, stock, image } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ message: "Name and price are required." });
    }
    const product = await Product.create({
      name,
      description,
      price,
      stock,
      image,
      seller: req.user.id,
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// Edit (owner or admin only)
router.put("/:id", protect, authorize("seller", "admin"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found." });

    if (product.seller.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "This is not your product." });
    }

    const { name, description, price, stock, image } = req.body;
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (image !== undefined) product.image = image;

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// Delete (owner or admin only)
router.delete("/:id", protect, authorize("seller", "admin"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found." });

    if (product.seller.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "This is not your product." });
    }

    await product.deleteOne();
    res.json({ message: "Product deleted." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

module.exports = router;