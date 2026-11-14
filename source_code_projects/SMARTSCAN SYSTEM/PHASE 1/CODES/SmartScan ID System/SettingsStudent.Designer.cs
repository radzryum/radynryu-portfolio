namespace SmartScan_ID_System_Project
{
    partial class SettingsStudent
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(SettingsStudent));
            this.btnBackSettings = new System.Windows.Forms.PictureBox();
            this.pbSettingsBg = new System.Windows.Forms.PictureBox();
            this.pbLogo = new System.Windows.Forms.PictureBox();
            this.btnLogoutStudent = new System.Windows.Forms.PictureBox();
            this.lblLogoutStudent = new System.Windows.Forms.Label();
            ((System.ComponentModel.ISupportInitialize)(this.btnBackSettings)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbSettingsBg)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbLogo)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnLogoutStudent)).BeginInit();
            this.SuspendLayout();
            // 
            // btnBackSettings
            // 
            this.btnBackSettings.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnBackSettings.Image = global::SmartScan_ID_System_Project.Properties.Resources.backBtn;
            this.btnBackSettings.Location = new System.Drawing.Point(1259, 12);
            this.btnBackSettings.Name = "btnBackSettings";
            this.btnBackSettings.Size = new System.Drawing.Size(100, 68);
            this.btnBackSettings.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.btnBackSettings.TabIndex = 0;
            this.btnBackSettings.TabStop = false;
            this.btnBackSettings.Click += new System.EventHandler(this.btnBackSettings_Click);
            // 
            // pbSettingsBg
            // 
            this.pbSettingsBg.Image = global::SmartScan_ID_System_Project.Properties.Resources.logoutForStudentFooter;
            this.pbSettingsBg.Location = new System.Drawing.Point(12, 455);
            this.pbSettingsBg.Name = "pbSettingsBg";
            this.pbSettingsBg.Size = new System.Drawing.Size(1185, 283);
            this.pbSettingsBg.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbSettingsBg.TabIndex = 1;
            this.pbSettingsBg.TabStop = false;
            // 
            // pbLogo
            // 
            this.pbLogo.Image = global::SmartScan_ID_System_Project.Properties.Resources.settingsHeader;
            this.pbLogo.Location = new System.Drawing.Point(416, 23);
            this.pbLogo.Name = "pbLogo";
            this.pbLogo.Size = new System.Drawing.Size(578, 219);
            this.pbLogo.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbLogo.TabIndex = 2;
            this.pbLogo.TabStop = false;
            // 
            // btnLogoutStudent
            // 
            this.btnLogoutStudent.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnLogoutStudent.Image = global::SmartScan_ID_System_Project.Properties.Resources.logoutBtnSettings;
            this.btnLogoutStudent.Location = new System.Drawing.Point(546, 261);
            this.btnLogoutStudent.Name = "btnLogoutStudent";
            this.btnLogoutStudent.Size = new System.Drawing.Size(338, 318);
            this.btnLogoutStudent.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.btnLogoutStudent.TabIndex = 3;
            this.btnLogoutStudent.TabStop = false;
            this.btnLogoutStudent.Click += new System.EventHandler(this.btnLogoutStudent_Click);
            // 
            // lblLogoutStudent
            // 
            this.lblLogoutStudent.AutoSize = true;
            this.lblLogoutStudent.BackColor = System.Drawing.Color.Transparent;
            this.lblLogoutStudent.Font = new System.Drawing.Font("Arial Rounded MT Bold", 19.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblLogoutStudent.ForeColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(0)))), ((int)(((byte)(0)))));
            this.lblLogoutStudent.Location = new System.Drawing.Point(652, 582);
            this.lblLogoutStudent.Name = "lblLogoutStudent";
            this.lblLogoutStudent.Size = new System.Drawing.Size(161, 38);
            this.lblLogoutStudent.TabIndex = 4;
            this.lblLogoutStudent.Text = "LOGOUT";
            // 
            // SettingsStudent
            // 
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.None;
            this.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(255)))), ((int)(((byte)(192)))));
            this.ClientSize = new System.Drawing.Size(1371, 734);
            this.Controls.Add(this.lblLogoutStudent);
            this.Controls.Add(this.btnLogoutStudent);
            this.Controls.Add(this.pbLogo);
            this.Controls.Add(this.pbSettingsBg);
            this.Controls.Add(this.btnBackSettings);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.Name = "SettingsStudent";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Settings";
            ((System.ComponentModel.ISupportInitialize)(this.btnBackSettings)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbSettingsBg)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbLogo)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnLogoutStudent)).EndInit();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.PictureBox btnBackSettings;
        private System.Windows.Forms.PictureBox pbSettingsBg;
        private System.Windows.Forms.PictureBox pbLogo;
        private System.Windows.Forms.PictureBox btnLogoutStudent;
        private System.Windows.Forms.Label lblLogoutStudent;
    }
}