[33mcommit 75b2d45ccfaa2758957cc3712121cc3c0d66fd3a[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m)[m
Author: naomiabe2004-sudo <EMAIL_MO@gmail.com>
Date:   Fri Oct 9 03:49:29 2026 +0800

    Debug user address

[1mdiff --git a/models/User.js b/models/User.js[m
[1mindex 389ccca..95fab0e 100644[m
[1m--- a/models/User.js[m
[1m+++ b/models/User.js[m
[36m@@ -3,6 +3,7 @@[m [mconst mongoose = require("mongoose");[m
 const userSchema = new mongoose.Schema([m
   {[m
     name: { type: String, required: true, trim: true },[m
[32m+[m
     email: {[m
       type: String,[m
       required: true,[m
[36m@@ -10,12 +11,30 @@[m [mconst userSchema = new mongoose.Schema([m
       lowercase: true,[m
       trim: true,[m
     },[m
[31m-    password: { type: String, required: true, minlength: 6 },[m
[32m+[m
[32m+[m[32m    password: {[m
[32m+[m[32m      type: String,[m
[32m+[m[32m      required: true,[m
[32m+[m[32m      minlength: 6,[m
[32m+[m[32m    },[m
[32m+[m
     role: {[m
       type: String,[m
       enum: ["buyer", "seller", "admin"],[m
       default: "buyer",[m
     },[m
[32m+[m
[32m+[m[32m    phone: {[m
[32m+[m[32m      type: String,[m
[32m+[m[32m      default: "",[m
[32m+[m[32m      trim: true,[m
[32m+[m[32m    },[m
[32m+[m
[32m+[m[32m    address: {[m
[32m+[m[32m      type: String,[m
[32m+[m[32m      default: "",[m
[32m+[m[32m      trim: true,[m
[32m+[m[32m    },[m
   },[m
   { timestamps: true }[m
 );[m
