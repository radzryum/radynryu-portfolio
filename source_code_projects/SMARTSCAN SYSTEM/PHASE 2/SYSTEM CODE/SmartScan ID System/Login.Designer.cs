using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SmartScan_ID_System_Project
{
    public partial class LoginPage : Form
    {
        private bool isPasswordVisible = false;

        private System.ComponentModel.IContainer components = null;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code
        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(LoginPage));
            this.loginPanel = new System.Windows.Forms.Panel();
            this.lblPassword = new System.Windows.Forms.Label();
            this.btnTogglePass = new System.Windows.Forms.Button();
            this.tbPassword = new System.Windows.Forms.TextBox();
            this.tbUsername = new System.Windows.Forms.TextBox();
            this.lblUsername = new System.Windows.Forms.Label();
            this.btnLogin = new System.Windows.Forms.PictureBox();
            this.pbUsername = new System.Windows.Forms.PictureBox();
            this.pbPassword = new System.Windows.Forms.PictureBox();
            this.pbLogo = new System.Windows.Forms.PictureBox();
            this.pbGroupPic = new System.Windows.Forms.PictureBox();
            this.pbPNC = new System.Windows.Forms.PictureBox();
            this.loginPanel.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.btnLogin)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbUsername)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbPassword)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbLogo)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbGroupPic)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbPNC)).BeginInit();
            this.SuspendLayout();
            // 
            // loginPanel
            // 
            this.loginPanel.BackColor = System.Drawing.Color.LightGreen;
            this.loginPanel.Controls.Add(this.lblPassword);
            this.loginPanel.Controls.Add(this.btnTogglePass);
            this.loginPanel.Controls.Add(this.tbPassword);
            this.loginPanel.Controls.Add(this.tbUsername);
            this.loginPanel.Controls.Add(this.lblUsername);
            this.loginPanel.Controls.Add(this.btnLogin);
            this.loginPanel.Controls.Add(this.pbUsername);
            this.loginPanel.Controls.Add(this.pbPassword);
            this.loginPanel.Location = new System.Drawing.Point(720, 200);
            this.loginPanel.Name = "loginPanel";
            this.loginPanel.Size = new System.Drawing.Size(587, 406);
            this.loginPanel.TabIndex = 3;
            this.loginPanel.Paint += new System.Windows.Forms.PaintEventHandler(this.panel1_Paint);
            // 
            // lblPassword
            // 
            this.lblPassword.AutoSize = true;
            this.lblPassword.BackColor = System.Drawing.Color.Transparent;
            this.lblPassword.Font = new System.Drawing.Font("Arial Rounded MT Bold", 16.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblPassword.ForeColor = System.Drawing.Color.DarkOliveGreen;
            this.lblPassword.Location = new System.Drawing.Point(57, 166);
            this.lblPassword.Name = "lblPassword";
            this.lblPassword.Size = new System.Drawing.Size(150, 32);
            this.lblPassword.TabIndex = 10;
            this.lblPassword.Text = "Password";
            // 
            // btnTogglePass
            // 
            this.btnTogglePass.BackColor = System.Drawing.Color.White;
            this.btnTogglePass.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnTogglePass.FlatAppearance.BorderSize = 0;
            this.btnTogglePass.FlatAppearance.MouseDownBackColor = System.Drawing.Color.White;
            this.btnTogglePass.FlatAppearance.MouseOverBackColor = System.Drawing.Color.White;
            this.btnTogglePass.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnTogglePass.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.btnTogglePass.ForeColor = System.Drawing.SystemColors.ControlDarkDark;
            this.btnTogglePass.Location = new System.Drawing.Point(443, 211);
            this.btnTogglePass.Name = "btnTogglePass";
            this.btnTogglePass.Size = new System.Drawing.Size(66, 31);
            this.btnTogglePass.TabIndex = 8;
            this.btnTogglePass.Text = "Show";
            this.btnTogglePass.UseVisualStyleBackColor = false;
            this.btnTogglePass.Click += new System.EventHandler(this.btnTogglePassword_Click);
            // 
            // tbPassword
            // 
            this.tbPassword.BorderStyle = System.Windows.Forms.BorderStyle.None;
            this.tbPassword.Font = new System.Drawing.Font("Arial Rounded MT Bold", 16.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.tbPassword.Location = new System.Drawing.Point(79, 211);
            this.tbPassword.Name = "tbPassword";
            this.tbPassword.Size = new System.Drawing.Size(378, 32);
            this.tbPassword.TabIndex = 7;
            this.tbPassword.UseSystemPasswordChar = true;
            // 
            // tbUsername
            // 
            this.tbUsername.BorderStyle = System.Windows.Forms.BorderStyle.None;
            this.tbUsername.Font = new System.Drawing.Font("Arial Rounded MT Bold", 16.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.tbUsername.Location = new System.Drawing.Point(79, 99);
            this.tbUsername.Name = "tbUsername";
            this.tbUsername.Size = new System.Drawing.Size(420, 32);
            this.tbUsername.TabIndex = 6;
            // 
            // lblUsername
            // 
            this.lblUsername.AutoSize = true;
            this.lblUsername.BackColor = System.Drawing.Color.Transparent;
            this.lblUsername.Font = new System.Drawing.Font("Arial Rounded MT Bold", 16.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblUsername.ForeColor = System.Drawing.Color.DarkOliveGreen;
            this.lblUsername.Location = new System.Drawing.Point(57, 53);
            this.lblUsername.Name = "lblUsername";
            this.lblUsername.Size = new System.Drawing.Size(155, 32);
            this.lblUsername.TabIndex = 2;
            this.lblUsername.Text = "Username";
            // 
            // btnLogin
            // 
            this.btnLogin.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnLogin.Image = global::SmartScan_ID_System_Project.Properties.Resources.login;
            this.btnLogin.Location = new System.Drawing.Point(178, 302);
            this.btnLogin.Name = "btnLogin";
            this.btnLogin.Size = new System.Drawing.Size(234, 74);
            this.btnLogin.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.btnLogin.TabIndex = 3;
            this.btnLogin.TabStop = false;
            this.btnLogin.Click += new System.EventHandler(this.btnLogin_Click);
            // 
            // pbUsername
            // 
            this.pbUsername.Image = global::SmartScan_ID_System_Project.Properties.Resources.textbox_border;
            this.pbUsername.Location = new System.Drawing.Point(45, 76);
            this.pbUsername.Name = "pbUsername";
            this.pbUsername.Size = new System.Drawing.Size(485, 79);
            this.pbUsername.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbUsername.TabIndex = 5;
            this.pbUsername.TabStop = false;
            // 
            // pbPassword
            // 
            this.pbPassword.Image = global::SmartScan_ID_System_Project.Properties.Resources.textbox_border;
            this.pbPassword.Location = new System.Drawing.Point(45, 188);
            this.pbPassword.Name = "pbPassword";
            this.pbPassword.Size = new System.Drawing.Size(485, 79);
            this.pbPassword.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbPassword.TabIndex = 9;
            this.pbPassword.TabStop = false;
            // 
            // pbLogo
            // 
            this.pbLogo.Image = global::SmartScan_ID_System_Project.Properties.Resources.pnc_header;
            this.pbLogo.Location = new System.Drawing.Point(647, 12);
            this.pbLogo.Name = "pbLogo";
            this.pbLogo.Size = new System.Drawing.Size(708, 134);
            this.pbLogo.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbLogo.TabIndex = 4;
            this.pbLogo.TabStop = false;
            // 
            // pbGroupPic
            // 
            this.pbGroupPic.BackColor = System.Drawing.Color.Transparent;
            this.pbGroupPic.Image = global::SmartScan_ID_System_Project.Properties.Resources.group;
            this.pbGroupPic.Location = new System.Drawing.Point(1043, 559);
            this.pbGroupPic.Name = "pbGroupPic";
            this.pbGroupPic.Size = new System.Drawing.Size(347, 219);
            this.pbGroupPic.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbGroupPic.TabIndex = 5;
            this.pbGroupPic.TabStop = false;
            // 
            // pbPNC
            // 
            this.pbPNC.Image = global::SmartScan_ID_System_Project.Properties.Resources.bg_home;
            this.pbPNC.Location = new System.Drawing.Point(0, -2);
            this.pbPNC.Name = "pbPNC";
            this.pbPNC.Size = new System.Drawing.Size(633, 740);
            this.pbPNC.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbPNC.TabIndex = 6;
            this.pbPNC.TabStop = false;
            // 
            // LoginPage
            // 
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.None;
            this.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(255)))), ((int)(((byte)(192)))));
            this.ClientSize = new System.Drawing.Size(1370, 734);
            this.Controls.Add(this.loginPanel);
            this.Controls.Add(this.pbLogo);
            this.Controls.Add(this.pbPNC);
            this.Controls.Add(this.pbGroupPic);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.Name = "LoginPage";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Log In";
            this.loginPanel.ResumeLayout(false);
            this.loginPanel.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.btnLogin)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbUsername)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbPassword)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbLogo)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbGroupPic)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbPNC)).EndInit();
            this.ResumeLayout(false);

        }
        #endregion

        // ============================
        // ROUNDED PANEL CODE
        // ============================
        private void panel1_Paint(object sender, PaintEventArgs e)
        {
            int radius = 30; // corner radius
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            Rectangle rect = new Rectangle(0, 0, loginPanel.Width, loginPanel.Height);
            int diameter = radius * 2;

            GraphicsPath path = new GraphicsPath();
            path.AddArc(rect.X, rect.Y, diameter, diameter, 180, 90);
            path.AddArc(rect.Right - diameter, rect.Y, diameter, diameter, 270, 90);
            path.AddArc(rect.Right - diameter, rect.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(rect.X, rect.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();

            loginPanel.Region = new Region(path);
        }

        // ============================
        // PASSWORD SHOW/HIDE TOGGLE
        // ============================
        private void btnTogglePassword_Click(object sender, EventArgs e)
        {
            isPasswordVisible = !isPasswordVisible;

            if (isPasswordVisible)
            {
                tbPassword.UseSystemPasswordChar = false;
                btnTogglePass.Text = "Hide";
            }
            else
            {
                tbPassword.UseSystemPasswordChar = true;
                btnTogglePass.Text = "Show";
            }

            // Set focus back to password field
            tbPassword.Focus();
        }


        private System.Windows.Forms.PictureBox pbPNC;
        private System.Windows.Forms.PictureBox pbGroupPic;
        private System.Windows.Forms.PictureBox pbLogo;
        private System.Windows.Forms.Panel loginPanel;
        private System.Windows.Forms.PictureBox pbUsername;
        private System.Windows.Forms.PictureBox btnLogin;
        private System.Windows.Forms.Label lblUsername;
        private TextBox tbUsername;
        private TextBox tbPassword;
        private Button btnTogglePass;
        private PictureBox pbPassword;
        private Label lblPassword;
    }
}