const express = require("express");

const router = express.Router();

const {
    verifyToken
} = require("../middleware/authMiddleware");

const {
    login,
    changePassword
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


module.exports = router;