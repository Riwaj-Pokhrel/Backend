const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendOtpEmail } = require("../utils/mailer");



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



// Forgot Password 

exports.forgotPassword = (req, res) => {

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            success: false,
            message: "Email is required."
        });
    }

    const genericMessage =
        "A reset code has been sent.";

    db.query(
        `SELECT id, full_name, is_active
         FROM users
         WHERE email=?`,
        [email],
        async (err, results) => {

            if (err) {
                console.error("Forgot Password Database Error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (
                results.length === 0 ||
                Number(results[0].is_active) !== 1
            ) {
                
                return res.json({
                    success: true,
                    message: genericMessage
                });
            }

            const user = results[0];

            const otp = Math.floor(
                100000 + Math.random() * 900000
            ).toString();

            const otpHash = await bcrypt.hash(otp, 10);

            const expires = new Date(Date.now() + 15 * 60 * 1000);

            db.query(
                `UPDATE users
                 SET reset_otp_hash=?,
                     reset_otp_expires=?
                 WHERE id=?`,
                [
                    otpHash,
                    expires,
                    user.id
                ],
                async (err) => {

                    if (err) {
                        console.error("Forgot Password Database Error:", err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    try {

                        await sendOtpEmail(email, user.full_name, otp);

                        return res.json({
                            success: true,
                            message: genericMessage
                        });

                    } catch (mailErr) {

                        console.error("Email Send Error:", mailErr);

                        return res.status(500).json({
                            success: false,
                            message:
                                "Could not send the reset email. Check the " +
                                "server's email configuration (EMAIL_USER / " +
                                "EMAIL_PASS in .env)."
                        });

                    }

                }
            );

        }
    );

};




//  Verify code and set new password

exports.resetPasswordWithOtp = (req, res) => {

    const {
        email,
        otp,
        new_password
    } = req.body;

    if (!email || !otp || !new_password) {
        return res.status(400).json({
            success: false,
            message: "Email, code, and new password are required."
        });
    }

    if (new_password.length < 6) {
        return res.status(400).json({
            success: false,
            message: "New password must be at least 6 characters."
        });
    }

    db.query(
        `SELECT id, reset_otp_hash, reset_otp_expires
         FROM users
         WHERE email=?`,
        [email],
        async (err, results) => {

            if (err) {
                console.error("Reset Password Database Error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (results.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or expired code."
                });
            }

            const user = results[0];

            if (!user.reset_otp_hash || !user.reset_otp_expires) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or expired code."
                });
            }

            if (new Date(user.reset_otp_expires) < new Date()) {
                return res.status(400).json({
                    success: false,
                    message: "This code has expired. Please request a new one."
                });
            }

            const otpMatch = await bcrypt.compare(
                otp,
                user.reset_otp_hash
            );

            if (!otpMatch) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid code."
                });
            }

            const hashedPassword = await bcrypt.hash(new_password, 10);

            db.query(
                `UPDATE users
                 SET password=?,
                     reset_otp_hash=NULL,
                     reset_otp_expires=NULL
                 WHERE id=?`,
                [
                    hashedPassword,
                    user.id
                ],
                (err) => {

                    if (err) {
                        console.error("Reset Password Database Error:", err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });
                    }

                    return res.json({
                        success: true,
                        message: "Password reset successfully. You can now log in."
                    });

                }
            );

        }
    );

};