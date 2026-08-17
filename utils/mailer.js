const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


exports.sendOtpEmail = async (toEmail, fullName, otp) => {

    await transporter.sendMail({
        from: `"Smart Attendance System" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: "Your Password Reset Code",
        text:
            `Hi ${fullName},\n\n` +
            `Your password reset code is: ${otp}\n\n` +
            `This code expires in 15 minutes. If you did not request ` +
            `a password reset, you can safely ignore this email.\n\n` +
            `- Smart Attendance System`
    });

};