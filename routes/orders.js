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
    const {
      items,
      customerName,
      customerPhone,
      deliveryAddress,
      paymentMethod,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Order has no items.",
      });
    }

    if (!deliveryAddress || !deliveryAddress.trim()) {
      return res.status(400).json({
        message: "Delivery address is required.",
      });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const it of items) {
      const qty = Number(it.quantity);

      if (!it.productId || !Number.isInteger(qty) || qty < 1) {
        throw {
          status: 400,
          message: "Invalid item.",
        };
      }

      const product = await Product.findOneAndUpdate(
        {
          _id: it.productId,
          stock: { $gte: qty },
        },
        {
          $inc: { stock: -qty },
        },
        {
          new: true,
        }
      );

      if (!product) {
        throw {
          status: 400,
          message: "Product not found or not enough stock.",
        };
      }

      reserved.push({
        id: product._id,
        qty,
      });

      orderItems.push({
        product: product._id,
        seller: product.seller,
        name: product.name,
        price: product.price,
        quantity: qty,
      });

      subtotal += product.price * qty;
    }

    const order = await Order.create({
      buyer: req.user.id,
      customerName: customerName || "",
      customerPhone: customerPhone || "",
      deliveryAddress: deliveryAddress.trim(),
      paymentMethod: paymentMethod || "COD",
      paymentStatus: "Pending",
      items: orderItems,
      subtotal,
      deliveryFee: 0,
      total: subtotal,
      status: paymentMethod?.toLowerCase() === "cod"
    ? "To Ship"
    : "To Pay",
    });

    await logAction(
      req,
      "ORDER_PLACED",
      "Order " + order._id + ", total " + order.total
    );

    return res.status(201).json(order);
  } catch (err) {
    for (const item of reserved) {
      await Product.updateOne(
        { _id: item.id },
        { $inc: { stock: item.qty } }
      );
    }

    if (err.name === "CastError") {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    return res.status(err.status || 500).json({
      message: err.message || "Server error.",
    });
  }
});

// Buyer's order history
router.get("/mine", protect, authorize("buyer"), async (req, res) => {
  try {
    const orders = await Order.find({
      buyer: req.user.id,
    }).sort({ createdAt: -1 });

    return res.json(orders);
  } catch (err) {
    return res.status(500).json({
      message: "Server error.",
      error: err.message,
    });
  }
});

// Seller's orders
router.get("/seller", protect, authorize("seller"), async (req, res) => {
  try {
    const orders = await Order.find({
      "items.seller": req.user.id,
    })
      .populate("buyer", "name email")
      .sort({ createdAt: -1 });

    const result = orders.map((order) => {
      const mine = order.items.filter(
        (item) => item.seller.toString() === req.user.id
      );

      return {
        _id: order._id,
        buyer: order.buyer,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.createdAt,
        items: mine,
        subtotal: mine.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ),
        total: order.total,
      };
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      message: "Server error.",
      error: err.message,
    });
  }
});

// Seller's sales summary
router.get("/sales", protect, authorize("seller"), async (req, res) => {
  try {
    const orders = await Order.find({
      "items.seller": req.user.id,
    })
      .populate("buyer", "name email")
      .sort({ createdAt: -1 });

    let totalSales = 0;
    let itemsSold = 0;

    const list = orders.map((order) => {
      const mine = order.items.filter(
        (item) => item.seller.toString() === req.user.id
      );

      const subtotal = mine.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      if (order.status !== "Cancelled") {
        totalSales += subtotal;
        itemsSold += mine.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
      }

      return {
        _id: order._id,
        buyer: order.buyer,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.createdAt,
        items: mine,
        subtotal,
        total: order.total,
      };
    });

    return res.json({
      totalSales,
      itemsSold,
      orderCount: list.filter(
        (order) => order.status !== "Cancelled"
      ).length,
      orders: list,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error.",
      error: err.message,
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
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid order status.",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      "items.seller": req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found.",
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

    return res.json({
      message: "Order status updated successfully!",
      order,
    });
  } catch (err) {
    console.error("Update order status error:", err);

    if (err.name === "CastError") {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    return res.status(500).json({
      message: "Could not update status.",
      error: err.message,
    });
  }
});

// Buyer cancels their own order
router.put("/:id/cancel", protect, authorize("buyer"), async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      buyer: req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    if (order.status !== "To Pay") {
      return res.status(400).json({
        message: "Only orders with To Pay status can be cancelled.",
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

    return res.json({
      message: "Order cancelled successfully!",
      order,
    });
  } catch (err) {
    console.error("Cancel order error:", err);

    if (err.name === "CastError") {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    return res.status(500).json({
      message: "Could not cancel order.",
      error: err.message,
    });
  }
});

module.exports = router;