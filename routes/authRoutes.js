const express = require("express");

const router = express.Router();

const {
    verifyToken
} = require("../middleware/authMiddleware");

const {
    login,
    changePassword,
    forgotPassword,
    resetPasswordWithOtp
} = require("../controllers/authController");


router.post(
    "/login",
    login
);


router.post(
    "/change-password",
    verifyToken,
    changePassword
);


router.post(
    "/forgot-password",
    forgotPassword
);



router.post(
    "/reset-password",
    resetPasswordWithOtp
);


module.exports = router;