const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const logAction = require("../utils/audit");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// Place an order (buyer only)
router.post("/", protect, authorize("buyer"), async (req, res) => {
  const reserved = [];

  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order has no items." });
    }

    const orderItems = [];
    let total = 0;

    for (const it of items) {
      const qty = Number(it.quantity);

      if (!it.productId || !Number.isInteger(qty) || qty < 1) {
        throw { status: 400, message: "Invalid item." };
      }

      const product = await Product.findOneAndUpdate(
        { _id: it.productId, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      );

      if (!product) {
        throw {
          status: 400,
          message: "Product not found or not enough stock."
        };
      }

      reserved.push({ id: product._id, qty });

      orderItems.push({
        product: product._id,
        seller: product.seller,
        name: product.name,
        price: product.price,
        quantity: qty
      });

      total += product.price * qty;
    }

    const order = await Order.create({
      buyer: req.user.id,
      items: orderItems,
      total
    });

    await logAction(
      req,
      "ORDER_PLACED",
      "Order " + order._id + ", total " + total
    );

    res.status(201).json(order);
  } catch (err) {
    for (const r of reserved) {
      await Product.updateOne(
        { _id: r.id },
        { $inc: { stock: r.qty } }
      );
    }

    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid product ID." });
    }

    res.status(err.status || 500).json({
      message: err.message || "Server error."
    });
  }
});

// Buyer's order history
router.get("/mine", protect, authorize("buyer"), async (req, res) => {
  try {
    const orders = await Order.find({
      buyer: req.user.id
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({
      message: "Server error.",
      error: err.message
    });
  }
});

// Seller's orders
router.get("/seller", protect, authorize("seller"), async (req, res) => {
  try {
    const orders = await Order.find({
      "items.seller": req.user.id
    })
      .populate("buyer", "name email")
      .sort({ createdAt: -1 });

    const result = orders.map((o) => {
      const mine = o.items.filter(
        (i) => i.seller.toString() === req.user.id
      );

      return {
        _id: o._id,
        buyer: o.buyer,
        status: o.status,
        createdAt: o.createdAt,
        items: mine,
        subtotal: mine.reduce(
          (sum, i) => sum + i.price * i.quantity,
          0
        )
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      message: "Server error.",
      error: err.message
    });
  }
});

// Seller's sales summary
router.get("/sales", protect, authorize("seller"), async (req, res) => {
  try {
    const orders = await Order.find({
      "items.seller": req.user.id
    })
      .populate("buyer", "name email")
      .sort({ createdAt: -1 });

    let totalSales = 0;
    let itemsSold = 0;

    const list = orders.map((o) => {
      const mine = o.items.filter(
        (i) => i.seller.toString() === req.user.id
      );

      const subtotal = mine.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
      );

      if (o.status !== "Cancelled") {
        totalSales += subtotal;
        itemsSold += mine.reduce(
          (sum, i) => sum + i.quantity,
          0
        );
      }

      return {
        _id: o._id,
        buyer: o.buyer,
        status: o.status,
        createdAt: o.createdAt,
        items: mine,
        subtotal
      };
    });

    res.json({
      totalSales,
      itemsSold,
      orderCount: list.filter(
        (o) => o.status !== "Cancelled"
      ).length,
      orders: list
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error.",
      error: err.message
    });
  }
});

// Seller updates order status
router.put("/:id/status", protect, authorize("seller"), async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "To Pay",
      "To Ship",
      "To Receive",
      "Completed",
      "Cancelled"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid order status."
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      "items.seller": req.user.id
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found."
      });
    }

    if (order.status !== status) {
      if (status === "Cancelled") {
        for (const item of order.items) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } }
          );
        }
      }

      order.status = status;
      await order.save();

      await logAction(
        req,
        "ORDER_STATUS_UPDATED",
        "Order " + order._id + " -> " + status
      );
    }

    res.json({
      message: "Order status updated successfully!",
      order
    });
  } catch (err) {
    console.error("Update order status error:", err);

    if (err.name === "CastError") {
      return res.status(400).json({
        message: "Invalid order ID."
      });
    }

    res.status(500).json({
      message: "Could not update status.",
      error: err.message
    });
  }
});

// Buyer cancels their own order
router.put("/:id/cancel", protect, authorize("buyer"), async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      buyer: req.user.id
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found."
      });
    }

    if (order.status !== "To Pay") {
      return res.status(400).json({
        message: "Only orders with To Pay status can be cancelled."
      });
    }

    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity } }
      );
    }

    order.status = "Cancelled";
    await order.save();

    await logAction(
      req,
      "ORDER_CANCELLED",
      "Order " + order._id
    );

    res.json({
      message: "Order cancelled successfully!",
      order
    });
  } catch (err) {
    console.error("Cancel order error:", err);

    if (err.name === "CastError") {
      return res.status(400).json({
        message: "Invalid order ID."
      });
    }

    res.status(500).json({
      message: "Could not cancel order.",
      error: err.message
    });
  }
});

module.exports = router;