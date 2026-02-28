const nodemailer = require('nodemailer');
const User = require('../models/User');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendHolidayNotification = async (employees, holiday) => {
  const emailPromises = employees.map(employee => {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@company.com',
      to: employee.email,
      subject: `Upcoming Holiday: ${holiday.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">🎉 Upcoming Holiday Notification</h2>
          <p>Dear ${employee.name},</p>
          <p>We hope this message finds you well. We wanted to remind you about an upcoming holiday:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #007bff; margin: 0 0 10px 0;">${holiday.name}</h3>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(holiday.date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            <p style="margin: 5px 0;"><strong>Type:</strong> ${holiday.type}</p>
            ${holiday.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${holiday.description}</p>` : ''}
          </div>
          
          <p>Please plan your work accordingly and enjoy the holiday!</p>
          
          <p>Best regards,<br>HR Team</p>
        </div>
      `
    };
    
    return transporter.sendMail(mailOptions);
  });

  try {
    await Promise.all(emailPromises);
    // console.log(`Holiday notification sent to ${employees.length} employees for ${holiday.name}`);
  } catch (error) {
    console.error('Error sending holiday notifications:', error);
  }
};

const sendLeaveApplicationNotification = async (leaveRequest) => {
  try {
    const employee = await User.findById(leaveRequest.userId).populate('managerId');
    const manager = employee.managerId;
    const hrUsers = await User.find({ role: 'HR' });
    
    const recipients = [];
    if (manager) recipients.push(manager);
    recipients.push(...hrUsers);
    
    const emailPromises = recipients.map(recipient => {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@company.com',
        to: recipient.email,
        subject: `Leave Application - ${employee.firstName} ${employee.lastName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">📋 New Leave Application</h2>
            <p>Dear ${recipient.firstName},</p>
            <p>A new leave application has been submitted and requires your approval:</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #007bff; margin: 0 0 15px 0;">Leave Details</h3>
              <p style="margin: 5px 0;"><strong>Employee:</strong> ${employee.firstName} ${employee.lastName}</p>
              <p style="margin: 5px 0;"><strong>Leave Type:</strong> ${leaveRequest.leaveTypeId?.name || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Start Date:</strong> ${new Date(leaveRequest.startDate).toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>End Date:</strong> ${new Date(leaveRequest.endDate).toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Duration:</strong> ${leaveRequest.days} day(s)</p>
              <p style="margin: 5px 0;"><strong>Reason:</strong> ${leaveRequest.reason}</p>
            </div>
            
            <p>Please review and approve this leave application at your earliest convenience.</p>
            <p>Best regards,<br>HR Team</p>
          </div>
        `
      };
      return transporter.sendMail(mailOptions);
    });
    
    await Promise.all(emailPromises);
    // console.log(`Leave application notification sent for ${employee.firstName} ${employee.lastName}`);
  } catch (error) {
    console.error('Error sending leave application notification:', error);
  }
};

const sendLeaveReminderNotification = async (leaveRequest) => {
  try {
    const employee = await User.findById(leaveRequest.userId).populate('managerId');
    const manager = employee.managerId;
    
    if (!manager) return;
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@company.com',
      to: manager.email,
      subject: `URGENT: Leave Approval Reminder - ${employee.firstName} ${employee.lastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">⚠️ URGENT: Leave Approval Reminder</h2>
          <p>Dear ${manager.firstName},</p>
          <p>This is a reminder that the following leave application is still pending your approval and the leave starts tomorrow:</p>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="color: #856404; margin: 0 0 15px 0;">Pending Leave Application</h3>
            <p style="margin: 5px 0;"><strong>Employee:</strong> ${employee.firstName} ${employee.lastName}</p>
            <p style="margin: 5px 0;"><strong>Leave Type:</strong> ${leaveRequest.leaveTypeId?.name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Start Date:</strong> ${new Date(leaveRequest.startDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>End Date:</strong> ${new Date(leaveRequest.endDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Duration:</strong> ${leaveRequest.days} day(s)</p>
            <p style="margin: 5px 0;"><strong>Reason:</strong> ${leaveRequest.reason}</p>
          </div>
          
          <p style="color: #dc3545; font-weight: bold;">Please approve or reject this application immediately as the leave starts tomorrow.</p>
          <p>Best regards,<br>HR Team</p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    // console.log(`Leave reminder sent to manager for ${employee.firstName} ${employee.lastName}`);
  } catch (error) {
    console.error('Error sending leave reminder notification:', error);
  }
};

const sendHalfDayLOPNotification = async (user, attendance) => {
  try {
    let subject, statusMessage, statusColor, requiredHours;
    
    if (attendance.totalHours < 4) {
      subject = 'LOP - Loss of Pay Due to Insufficient Working Hours';
      statusMessage = 'LOP (Loss of Pay)';
      statusColor = '#dc3545';
      requiredHours = 'Minimum 4 hours for half day, 8 hours for full day';
    } else if (attendance.totalHours < 8) {
      subject = 'Half Day - Insufficient Working Hours';
      statusMessage = 'Half Day';
      statusColor = '#ffc107';
      requiredHours = 'Minimum 8 hours for full day';
    }
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@company.com',
      to: user.email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${statusColor};">⚠️ ${statusMessage} Notice</h2>
          <p>Dear ${user.firstName},</p>
          <p>Your attendance for today has been marked as ${statusMessage} due to insufficient working hours:</p>
          
          <div style="background-color: ${attendance.totalHours < 4 ? '#f8d7da' : '#fff3cd'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
            <h3 style="color: ${attendance.totalHours < 4 ? '#721c24' : '#856404'}; margin: 0 0 15px 0;">Attendance Details</h3>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(attendance.date).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Check In:</strong> ${new Date(attendance.checkIn).toLocaleTimeString()}</p>
            <p style="margin: 5px 0;"><strong>Check Out:</strong> ${new Date(attendance.checkOut).toLocaleTimeString()}</p>
            <p style="margin: 5px 0;"><strong>Total Hours:</strong> ${attendance.totalHours} hours</p>
            <p style="margin: 5px 0;"><strong>Required:</strong> ${requiredHours}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> ${attendance.status}</p>
          </div>
          
          <p>${attendance.totalHours < 4 ? 
            'This will be marked as Loss of Pay (LOP) and no salary will be credited for this day.' : 
            'This will be reflected as a half day deduction in your payroll.'} Please ensure you complete minimum working hours daily.</p>
          <p>For any queries, please contact HR.</p>
          
          <p>Best regards,<br>HR Team</p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    // console.log(`${statusMessage} notification sent to ${user.firstName} ${user.lastName}`);
  } catch (error) {
    console.error('Error sending attendance notification:', error);
  }
};

const sendLeaveApprovalNotification = async (leaveRequest, approverName, approvalType) => {
  try {
    const employee = await User.findById(leaveRequest.userId);
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@company.com',
      to: employee.email,
      subject: `Leave Approved - ${new Date(leaveRequest.startDate).toLocaleDateString()} to ${new Date(leaveRequest.endDate).toLocaleDateString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">✅ Leave Request Approved</h2>
          <p>Dear ${employee.firstName},</p>
          <p>Your leave request has been approved by ${approverName} (${approvalType}):</p>
          
          <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="color: #155724; margin: 0 0 15px 0;">Approved Leave Details</h3>
            <p style="margin: 5px 0;"><strong>Leave Type:</strong> ${leaveRequest.leaveTypeId?.name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>From:</strong> ${new Date(leaveRequest.startDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>To:</strong> ${new Date(leaveRequest.endDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Duration:</strong> ${leaveRequest.days} day(s)</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> ${leaveRequest.status.replace('_', ' ')}</p>
          </div>
          
          <p>You can now proceed with your planned leave. Have a great time!</p>
          <p>Best regards,<br>HR Team</p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    // console.log(`Leave approval notification sent to ${employee.firstName} ${employee.lastName}`);
  } catch (error) {
    console.error('Error sending leave approval notification:', error);
  }
};

const sendAnnouncementNotification = async (announcement, creatorName) => {
  try {
    const employees = await User.find({ isActive: true });
    
    // Send emails in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < employees.length; i += batchSize) {
      const batch = employees.slice(i, i + batchSize);
      
      const emailPromises = batch.map(employee => {
        const priorityColor = announcement.priority === 'High' ? '#dc3545' : 
                             announcement.priority === 'Medium' ? '#ffc107' : '#28a745';
        
        const mailOptions = {
          from: process.env.SMTP_FROM || 'noreply@company.com',
          to: employee.email,
          subject: `[${announcement.priority} Priority] ${announcement.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${priorityColor};">📢 New Announcement</h2>
              <p>Dear ${employee.firstName},</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${priorityColor};">
                <h3 style="color: #333; margin: 0 0 15px 0;">${announcement.title}</h3>
                <p style="margin: 10px 0; color: #666; line-height: 1.6;">${announcement.content}</p>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                  <p style="margin: 5px 0; font-size: 14px;"><strong>Priority:</strong> <span style="color: ${priorityColor};">${announcement.priority}</span></p>
                  <p style="margin: 5px 0; font-size: 14px;"><strong>Posted by:</strong> ${creatorName}</p>
                  ${announcement.expiryDate ? `<p style="margin: 5px 0; font-size: 14px;"><strong>Valid until:</strong> ${new Date(announcement.expiryDate).toLocaleDateString()}</p>` : ''}
                </div>
              </div>
              
              <p>Best regards,<br>Management Team</p>
            </div>
          `
        };
        return transporter.sendMail(mailOptions).catch(err => {
          console.error(`Failed to send to ${employee.email}:`, err.message);
        });
      });
      
      await Promise.all(emailPromises);
      
      // Wait 2 seconds between batches to avoid rate limiting
      if (i + batchSize < employees.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // console.log(`Announcement notification sent to ${employees.length} employees`);
  } catch (error) {
    console.error('Error sending announcement notification:', error);
  }
};

const sendBirthdayWishes = async (employee) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@company.com',
      to: employee.email,
      subject: `🎉 Happy Birthday ${employee.firstName}! 🎂`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0; border-radius: 15px; overflow: hidden;">
          <div style="background: white; margin: 20px; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <div style="background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 2.5em; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">🎉 HAPPY BIRTHDAY! 🎉</h1>
              <div style="font-size: 4em; margin: 10px 0;">🎂</div>
            </div>
            
            <div style="padding: 30px; text-align: center;">
              <h2 style="color: #333; margin: 0 0 20px 0; font-size: 1.8em;">Dear ${employee.firstName},</h2>
              
              <div style="background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%); color: white; padding: 25px; border-radius: 10px; margin: 20px 0;">
                <p style="margin: 0; font-size: 1.2em; line-height: 1.6;">🌟 Today is your special day! 🌟</p>
                <p style="margin: 15px 0 0 0; font-size: 1.1em;">We hope your birthday is filled with happiness, laughter, and wonderful memories!</p>
              </div>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #28a745;">
                <p style="margin: 0; color: #333; font-size: 1.1em; line-height: 1.6;">
                  🎈 On behalf of the entire team, we wish you a fantastic birthday and a year ahead filled with success, joy, and prosperity! 🎈
                </p>
              </div>
              
              <div style="margin: 30px 0; padding: 20px; background: linear-gradient(135deg, #fd79a8 0%, #fdcb6e 100%); border-radius: 10px;">
                <h3 style="color: white; margin: 0 0 15px 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">🎁 Birthday Wishes from Your Work Family! 🎁</h3>
                <p style="color: white; margin: 0; font-size: 1.1em; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">May this new year of your life bring you endless opportunities and amazing adventures!</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; background: linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%); color: white; padding: 15px 30px; border-radius: 25px; font-size: 1.2em; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">
                  🎊 ENJOY YOUR SPECIAL DAY! 🎊
                </div>
              </div>
              
              <div style="border-top: 2px solid #e9ecef; padding-top: 20px; margin-top: 30px;">
                <p style="color: #666; margin: 0; font-style: italic;">With warmest birthday wishes,</p>
                <p style="color: #333; margin: 5px 0 0 0; font-weight: bold; font-size: 1.1em;">Your Amazing Team & HR Department</p>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: white;">
            <p style="margin: 0; opacity: 0.8;">🎂 Have a wonderful birthday celebration! 🎂</p>
          </div>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    // console.log(`Birthday wishes sent to ${employee.firstName} ${employee.lastName}`);
  } catch (error) {
    console.error('Error sending birthday wishes:', error);
  }
};

const sendWelcomeEmail = async ({ to, name, password, loginUrl }) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@company.com',
      to: to,
      subject: 'Welcome to the Team! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">🎉 Welcome Aboard!</h2>
          <p>Dear ${name},</p>
          <p>Welcome to our team! We're excited to have you on board.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #007bff; margin: 0 0 15px 0;">Your Login Credentials</h3>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${to}</p>
            <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #e9ecef; padding: 5px 10px; border-radius: 4px;">${password}</code></p>
            <p style="margin: 15px 0 5px 0;"><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">⚠️ <strong>Important:</strong> Please change your password after first login for security.</p>
          </div>
          
          <p>If you have any questions, feel free to reach out to HR.</p>
          <p>Best regards,<br>HR Team</p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

module.exports = { 
  sendHolidayNotification, 
  sendLeaveApplicationNotification, 
  sendLeaveReminderNotification,
  sendHalfDayLOPNotification,
  sendLeaveApprovalNotification,
  sendAnnouncementNotification,
  sendBirthdayWishes,
  sendWelcomeEmail
};