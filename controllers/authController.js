const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");



// Login

exports.login = (req, res) => {

    const {
        email,
        password
    } = req.body;


   
    // Validate input
   
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required."
        });
    }


   
    // Find user
   
    db.query(
        `SELECT
            id,
            full_name,
            email,
            password,
            role,
            is_department_admin,
            roll_no,
            is_active
         FROM users
         WHERE email=?`,
        [email],
        async (err, results) => {

            if (err) {
                console.error("Login Database Error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }


            if (results.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password."
                });
            }


            const user = results[0];


           
            // Check active status
           
            if (Number(user.is_active) !== 1) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is inactive."
                });
            }


           
            // Compare password
           
            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );


            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password."
                });
            }


           
            // Create JWT
           
            const token = jwt.sign(
                {
                    id: user.id,
                    role: user.role,
                    is_department_admin: Number(
                        user.is_department_admin
                    )
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "1d"
                }
            );


           
            // Send response
           
            return res.json({
                success: true,
                message: "Login successful.",

                token,

                user: {
                    id: user.id,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role,
                    is_department_admin:
                        Number(user.is_department_admin),
                    roll_no: user.roll_no,
                    is_active: Number(user.is_active)
                }
            });

        }
    );

};



// Change Password
//
// Any logged-in user (SUPER_ADMIN, TEACHER, or STUDENT) can
// change their own password. Requires the current password to
// confirm identity, same as any standard change-password flow.


exports.changePassword = (req, res) => {

    const {
        current_password,
        new_password
    } = req.body;


    if (!current_password || !new_password) {
        return res.status(400).json({
            success: false,
            message: "Current password and new password are required."
        });
    }


    if (new_password.length < 6) {
        return res.status(400).json({
            success: false,
            message: "New password must be at least 6 characters."
        });
    }


    if (new_password === current_password) {
        return res.status(400).json({
            success: false,
            message: "New password must be different from the current password."
        });
    }


    db.query(
        `SELECT id, password
         FROM users
         WHERE id=?`,
        [req.user.id],
        async (err, results) => {

            if (err) {
                console.error("Change Password Database Error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }


            if (results.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "User not found."
                });
            }


            const user = results[0];


            const currentPasswordMatch = await bcrypt.compare(
                current_password,
                user.password
            );


            if (!currentPasswordMatch) {
                return res.status(401).json({
                    success: false,
                    message: "Current password is incorrect."
                });
            }


            const hashedNewPassword = await bcrypt.hash(new_password, 10);


            db.query(
                `UPDATE users
                 SET password=?
                 WHERE id=?`,
                [
                    hashedNewPassword,
                    req.user.id
                ],
                (err, result) => {

                    if (err) {
                        console.error("Change Password Database Error:", err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }


                    return res.json({
                        success: true,
                        message: "Password changed successfully."
                    });

                }
            );

        }
    );

};