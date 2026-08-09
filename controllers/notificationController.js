const db = require("../config/db");



// Internal Helper
// Create Notification


const createNotification = (
    user_id,
    title,
    message,
    callback
) => {

    db.query(
        `INSERT INTO notifications
        (
            user_id,
            title,
            message
        )
        VALUES (?, ?, ?)`,
        [
            user_id,
            title,
            message
        ],
        (err, result) => {

            if (err) {
                return callback(err);
            }

            callback(null, result.insertId);
        }
    );
};



// Internal Helper
// Notify All Students In A Class


const notifyClassStudents = (
    class_id,
    title,
    message,
    callback
) => {

    db.query(
        `SELECT DISTINCT u.id
         FROM users u
         JOIN student_classes sc
             ON u.id=sc.student_id
         WHERE sc.class_id=?
         AND u.role='STUDENT'
         AND u.is_active=1`,
        [class_id],
        (err, students) => {

            if (err) {
                return callback(err);
            }

            if (students.length === 0) {
                return callback(null);
            }

            let completed = 0;
            let failed = false;

            students.forEach((student) => {

                createNotification(
                    student.id,
                    title,
                    message,
                    (err) => {

                        if (failed) {
                            return;
                        }

                        if (err) {
                            failed = true;
                            return callback(err);
                        }

                        completed++;

                        if (completed === students.length) {
                            callback(null);
                        }

                    }
                );

            });

        }
    );
};



// Internal Helper
// Notify Teacher


const notifyTeacher = (
    teacher_id,
    title,
    message,
    callback
) => {

    createNotification(
        teacher_id,
        title,
        message,
        callback
    );
};



// Get My Notifications


exports.getMyNotifications = (req, res) => {

    const user_id = req.user.id;

    db.query(
        `SELECT
            id,
            title,
            message,
            is_read,
            created_at
         FROM notifications
         WHERE user_id=?
         ORDER BY created_at DESC`,
        [user_id],
        (err, results) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            return res.json({
                success: true,
                notifications: results
            });

        }
    );
};



// Get Unread Notifications


exports.getUnreadNotifications = (req, res) => {

    const user_id = req.user.id;

    db.query(
        `SELECT
            id,
            title,
            message,
            is_read,
            created_at
         FROM notifications
         WHERE user_id=?
         AND is_read=0
         ORDER BY created_at DESC`,
        [user_id],
        (err, results) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            return res.json({
                success: true,
                notifications: results
            });

        }
    );
};



// Mark One Notification As Read


exports.markNotificationAsRead = (req, res) => {

    const { id } = req.params;

    db.query(
        `UPDATE notifications
         SET is_read=1
         WHERE id=?
         AND user_id=?`,
        [
            id,
            req.user.id
        ],
        (err, result) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found."
                });
            }

            return res.json({
                success: true,
                message: "Notification marked as read."
            });

        }
    );
};



// Mark All Notifications As Read


exports.markAllNotificationsAsRead = (req, res) => {

    db.query(
        `UPDATE notifications
         SET is_read=1
         WHERE user_id=?
         AND is_read=0`,
        [req.user.id],
        (err, result) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            return res.json({
                success: true,
                message: "All notifications marked as read.",
                updated: result.affectedRows
            });

        }
    );
};



// Delete Notification


exports.deleteNotification = (req, res) => {

    const { id } = req.params;

    db.query(
        `DELETE FROM notifications
         WHERE id=?
         AND user_id=?`,
        [
            id,
            req.user.id
        ],
        (err, result) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found."
                });
            }

            return res.json({
                success: true,
                message: "Notification deleted successfully."
            });

        }
    );
};



exports.createNotification = createNotification;

exports.notifyClassStudents = notifyClassStudents;

exports.notifyTeacher = notifyTeacher;