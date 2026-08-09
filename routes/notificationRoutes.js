const express = require("express");

const router = express.Router();

const {
    verifyToken
} = require("../middleware/authMiddleware");

const notificationController =
    require("../controllers/notificationController");



// Get My Notifications


router.get(
    "/",
    verifyToken,
    notificationController.getMyNotifications
);



// Get Unread Notifications


router.get(
    "/unread",
    verifyToken,
    notificationController.getUnreadNotifications
);



// Mark One Notification As Read


router.patch(
    "/:id/read",
    verifyToken,
    notificationController.markNotificationAsRead
);



// Mark All Notifications As Read


router.patch(
    "/read-all",
    verifyToken,
    notificationController.markAllNotificationsAsRead
);



// Delete Notification


router.delete(
    "/:id",
    verifyToken,
    notificationController.deleteNotification
);


module.exports = router;