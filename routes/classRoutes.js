
const express = require("express");

const router = express.Router();

const {
    verifyToken,
    allowRoles
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
    allowRoles("SUPER_ADMIN", "TEACHER"),
    createClass
);



// View Classes
// SUPER_ADMIN / Department Admin


router.get(
    "/",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    getAllClasses
);



// Update Class
// SUPER_ADMIN / Department Admin


router.put(
    "/:id",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    updateClass
);



// Activate / Deactivate Class
// SUPER_ADMIN / Department Admin


router.patch(
    "/:id/status",
    verifyToken,
    allowRoles("SUPER_ADMIN", "TEACHER"),
    toggleClassStatus
);


module.exports = router;

