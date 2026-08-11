const express = require("express");

const router = express.Router();

const {
    verifyToken,
    allowAdminAccess
} = require("../middleware/authMiddleware");

const {
    createClass,
    getAllClasses,
    updateClass,
    toggleClassStatus
} = require("../controllers/classController");



// Create Class
// SUPER_ADMIN / Department Admin


router.post(
    "/",
    verifyToken,
    allowAdminAccess,
    createClass
);



// View Classes
// SUPER_ADMIN / Department Admin


router.get(
    "/",
    verifyToken,
    allowAdminAccess,
    getAllClasses
);



// Update Class
// SUPER_ADMIN / Department Admin


router.put(
    "/:id",
    verifyToken,
    allowAdminAccess,
    updateClass
);



// Activate / Deactivate Class
// SUPER_ADMIN / Department Admin


router.patch(
    "/:id/status",
    verifyToken,
    allowAdminAccess,
    toggleClassStatus
);


module.exports = router;