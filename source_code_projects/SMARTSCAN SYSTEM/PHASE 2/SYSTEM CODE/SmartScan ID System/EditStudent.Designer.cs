namespace SmartScan_ID_System_Project
{
    partial class EditStudent
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
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(EditStudent));
            this.btnBack = new System.Windows.Forms.PictureBox();
            this.btnSettings = new System.Windows.Forms.PictureBox();
            this.pbStudentRecords = new System.Windows.Forms.PictureBox();
            this.panelStudentRec = new System.Windows.Forms.Panel();
            this.cboProgram = new System.Windows.Forms.ComboBox();
            this.btnSave = new System.Windows.Forms.Button();
            this.cboStatus = new System.Windows.Forms.ComboBox();
            this.label2 = new System.Windows.Forms.Label();
            this.pbStatus = new System.Windows.Forms.PictureBox();
            this.label1 = new System.Windows.Forms.Label();
            this.pbProgram = new System.Windows.Forms.PictureBox();
            this.tbName = new System.Windows.Forms.TextBox();
            this.lblName = new System.Windows.Forms.Label();
            this.pbName = new System.Windows.Forms.PictureBox();
            this.lblPfp = new System.Windows.Forms.Label();
            this.btnPfp = new System.Windows.Forms.Button();
            this.pbPfp = new System.Windows.Forms.PictureBox();
            this.panelPfp = new System.Windows.Forms.Panel();
            this.lblEditStud = new System.Windows.Forms.Label();
            this.panelEditStud = new System.Windows.Forms.Panel();
            this.openFileDialog = new System.Windows.Forms.OpenFileDialog();
            ((System.ComponentModel.ISupportInitialize)(this.btnBack)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnSettings)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbStudentRecords)).BeginInit();
            this.panelStudentRec.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbStatus)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbProgram)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbName)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbPfp)).BeginInit();
            this.panelPfp.SuspendLayout();
            this.panelEditStud.SuspendLayout();
            this.SuspendLayout();
            // 
            // btnBack
            // 
            this.btnBack.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnBack.Image = global::SmartScan_ID_System_Project.Properties.Resources.backBtn2;
            this.btnBack.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.btnBack.Location = new System.Drawing.Point(1224, 11);
            this.btnBack.Name = "btnBack";
            this.btnBack.Size = new System.Drawing.Size(62, 56);
            this.btnBack.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.btnBack.TabIndex = 12;
            this.btnBack.TabStop = false;
            this.btnBack.Click += new System.EventHandler(this.btnBack_Click);
            // 
            // btnSettings
            // 
            this.btnSettings.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnSettings.Image = global::SmartScan_ID_System_Project.Properties.Resources.settings;
            this.btnSettings.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.btnSettings.Location = new System.Drawing.Point(1301, 11);
            this.btnSettings.Name = "btnSettings";
            this.btnSettings.Size = new System.Drawing.Size(62, 56);
            this.btnSettings.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.btnSettings.TabIndex = 11;
            this.btnSettings.TabStop = false;
            this.btnSettings.Click += new System.EventHandler(this.btnSettings_Click);
            // 
            // pbStudentRecords
            // 
            this.pbStudentRecords.Image = global::SmartScan_ID_System_Project.Properties.Resources.studentsRecordHeader;
            this.pbStudentRecords.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.pbStudentRecords.Location = new System.Drawing.Point(-1, -2);
            this.pbStudentRecords.Name = "pbStudentRecords";
            this.pbStudentRecords.Size = new System.Drawing.Size(1377, 185);
            this.pbStudentRecords.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbStudentRecords.TabIndex = 10;
            this.pbStudentRecords.TabStop = false;
            // 
            // panelStudentRec
            // 
            this.panelStudentRec.BackColor = System.Drawing.Color.MediumSeaGreen;
            this.panelStudentRec.Controls.Add(this.cboProgram);
            this.panelStudentRec.Controls.Add(this.btnSave);
            this.panelStudentRec.Controls.Add(this.cboStatus);
            this.panelStudentRec.Controls.Add(this.label2);
            this.panelStudentRec.Controls.Add(this.pbStatus);
            this.panelStudentRec.Controls.Add(this.label1);
            this.panelStudentRec.Controls.Add(this.pbProgram);
            this.panelStudentRec.Controls.Add(this.tbName);
            this.panelStudentRec.Controls.Add(this.lblName);
            this.panelStudentRec.Controls.Add(this.pbName);
            this.panelStudentRec.Location = new System.Drawing.Point(534, 305);
            this.panelStudentRec.Name = "panelStudentRec";
            this.panelStudentRec.Size = new System.Drawing.Size(828, 419);
            this.panelStudentRec.TabIndex = 13;
            // 
            // cboProgram
            // 
            this.cboProgram.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.cboProgram.Font = new System.Drawing.Font("Arial Rounded MT Bold", 12F);
            this.cboProgram.FormattingEnabled = true;
            this.cboProgram.Items.AddRange(new object[] {
            "Bachelor of Science in Information Technology",
            "Bachelor of Science in Computer Science",
            "Bachelor of Science in Accountancy",
            "Bachelor of Science in Nursing"});
            this.cboProgram.Location = new System.Drawing.Point(340, 161);
            this.cboProgram.Name = "cboProgram";
            this.cboProgram.Size = new System.Drawing.Size(378, 31);
            this.cboProgram.TabIndex = 25;
            // 
            // btnSave
            // 
            this.btnSave.BackColor = System.Drawing.Color.Honeydew;
            this.btnSave.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnSave.FlatAppearance.BorderSize = 0;
            this.btnSave.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.8F);
            this.btnSave.ForeColor = System.Drawing.Color.DarkGreen;
            this.btnSave.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.btnSave.Location = new System.Drawing.Point(340, 322);
            this.btnSave.Name = "btnSave";
            this.btnSave.Size = new System.Drawing.Size(149, 47);
            this.btnSave.TabIndex = 23;
            this.btnSave.Text = "Save";
            this.btnSave.UseVisualStyleBackColor = false;
            this.btnSave.Click += new System.EventHandler(this.btnSave_Click);
            // 
            // cboStatus
            // 
            this.cboStatus.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.cboStatus.Font = new System.Drawing.Font("Arial Rounded MT Bold", 12F);
            this.cboStatus.FormattingEnabled = true;
            this.cboStatus.Items.AddRange(new object[] {
            "Regular",
            "Irregular"});
            this.cboStatus.Location = new System.Drawing.Point(341, 232);
            this.cboStatus.Name = "cboStatus";
            this.cboStatus.Size = new System.Drawing.Size(378, 31);
            this.cboStatus.TabIndex = 22;
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Font = new System.Drawing.Font("Arial Rounded MT Bold", 13.8F);
            this.label2.ForeColor = System.Drawing.Color.White;
            this.label2.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.label2.Location = new System.Drawing.Point(75, 234);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(90, 27);
            this.label2.TabIndex = 19;
            this.label2.Text = "Status:";
            // 
            // pbStatus
            // 
            this.pbStatus.Image = ((System.Drawing.Image)(resources.GetObject("pbStatus.Image")));
            this.pbStatus.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.pbStatus.Location = new System.Drawing.Point(309, 220);
            this.pbStatus.Name = "pbStatus";
            this.pbStatus.Size = new System.Drawing.Size(443, 47);
            this.pbStatus.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbStatus.TabIndex = 20;
            this.pbStatus.TabStop = false;
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Font = new System.Drawing.Font("Arial Rounded MT Bold", 13.8F);
            this.label1.ForeColor = System.Drawing.Color.White;
            this.label1.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.label1.Location = new System.Drawing.Point(75, 165);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(116, 27);
            this.label1.TabIndex = 19;
            this.label1.Text = "Program:";
            // 
            // pbProgram
            // 
            this.pbProgram.Image = ((System.Drawing.Image)(resources.GetObject("pbProgram.Image")));
            this.pbProgram.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.pbProgram.Location = new System.Drawing.Point(309, 149);
            this.pbProgram.Name = "pbProgram";
            this.pbProgram.Size = new System.Drawing.Size(443, 47);
            this.pbProgram.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbProgram.TabIndex = 20;
            this.pbProgram.TabStop = false;
            // 
            // tbName
            // 
            this.tbName.BackColor = System.Drawing.Color.White;
            this.tbName.BorderStyle = System.Windows.Forms.BorderStyle.None;
            this.tbName.Font = new System.Drawing.Font("Arial Rounded MT Bold", 12F);
            this.tbName.Location = new System.Drawing.Point(344, 93);
            this.tbName.MaximumSize = new System.Drawing.Size(500, 500);
            this.tbName.Name = "tbName";
            this.tbName.Size = new System.Drawing.Size(378, 24);
            this.tbName.TabIndex = 15;
            // 
            // lblName
            // 
            this.lblName.AutoSize = true;
            this.lblName.Font = new System.Drawing.Font("Arial Rounded MT Bold", 13.8F);
            this.lblName.ForeColor = System.Drawing.Color.White;
            this.lblName.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.lblName.Location = new System.Drawing.Point(75, 96);
            this.lblName.Name = "lblName";
            this.lblName.Size = new System.Drawing.Size(177, 27);
            this.lblName.TabIndex = 4;
            this.lblName.Text = "Student Name:";
            // 
            // pbName
            // 
            this.pbName.Image = ((System.Drawing.Image)(resources.GetObject("pbName.Image")));
            this.pbName.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.pbName.Location = new System.Drawing.Point(309, 78);
            this.pbName.Name = "pbName";
            this.pbName.Size = new System.Drawing.Size(443, 47);
            this.pbName.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbName.TabIndex = 7;
            this.pbName.TabStop = false;
            // 
            // lblPfp
            // 
            this.lblPfp.AutoSize = true;
            this.lblPfp.Font = new System.Drawing.Font("Arial Rounded MT Bold", 13.8F);
            this.lblPfp.ForeColor = System.Drawing.Color.DarkGreen;
            this.lblPfp.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.lblPfp.Location = new System.Drawing.Point(154, 38);
            this.lblPfp.Name = "lblPfp";
            this.lblPfp.Size = new System.Drawing.Size(185, 27);
            this.lblPfp.TabIndex = 28;
            this.lblPfp.Text = "Profile Picture: ";
            // 
            // btnPfp
            // 
            this.btnPfp.BackColor = System.Drawing.Color.Transparent;
            this.btnPfp.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnPfp.FlatAppearance.BorderSize = 0;
            this.btnPfp.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.8F);
            this.btnPfp.ForeColor = System.Drawing.Color.DarkGreen;
            this.btnPfp.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.btnPfp.Location = new System.Drawing.Point(169, 455);
            this.btnPfp.Name = "btnPfp";
            this.btnPfp.Size = new System.Drawing.Size(153, 27);
            this.btnPfp.TabIndex = 27;
            this.btnPfp.Text = "Upload Image";
            this.btnPfp.UseVisualStyleBackColor = false;
            this.btnPfp.Click += new System.EventHandler(this.btnPfp_Click);
            // 
            // pbPfp
            // 
            this.pbPfp.BackColor = System.Drawing.Color.Honeydew;
            this.pbPfp.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.pbPfp.Location = new System.Drawing.Point(28, 89);
            this.pbPfp.Name = "pbPfp";
            this.pbPfp.Size = new System.Drawing.Size(460, 342);
            this.pbPfp.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbPfp.TabIndex = 26;
            this.pbPfp.TabStop = false;
            // 
            // panelPfp
            // 
            this.panelPfp.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(255)))), ((int)(((byte)(192)))));
            this.panelPfp.Controls.Add(this.lblPfp);
            this.panelPfp.Controls.Add(this.pbPfp);
            this.panelPfp.Controls.Add(this.btnPfp);
            this.panelPfp.Location = new System.Drawing.Point(8, 192);
            this.panelPfp.Name = "panelPfp";
            this.panelPfp.Size = new System.Drawing.Size(520, 530);
            this.panelPfp.TabIndex = 29;
            // 
            // lblEditStud
            // 
            this.lblEditStud.AutoSize = true;
            this.lblEditStud.Font = new System.Drawing.Font("Arial Rounded MT Bold", 19.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblEditStud.ForeColor = System.Drawing.Color.White;
            this.lblEditStud.ImeMode = System.Windows.Forms.ImeMode.NoControl;
            this.lblEditStud.Location = new System.Drawing.Point(165, 36);
            this.lblEditStud.Name = "lblEditStud";
            this.lblEditStud.Size = new System.Drawing.Size(508, 38);
            this.lblEditStud.TabIndex = 26;
            this.lblEditStud.Text = "EDIT STUDENT INFORMATION";
            // 
            // panelEditStud
            // 
            this.panelEditStud.BackColor = System.Drawing.Color.SeaGreen;
            this.panelEditStud.Controls.Add(this.lblEditStud);
            this.panelEditStud.Location = new System.Drawing.Point(537, 194);
            this.panelEditStud.Name = "panelEditStud";
            this.panelEditStud.Size = new System.Drawing.Size(822, 105);
            this.panelEditStud.TabIndex = 30;
            // 
            // EditStudent
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(8F, 16F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(1371, 734);
            this.Controls.Add(this.panelEditStud);
            this.Controls.Add(this.panelPfp);
            this.Controls.Add(this.panelStudentRec);
            this.Controls.Add(this.btnBack);
            this.Controls.Add(this.btnSettings);
            this.Controls.Add(this.pbStudentRecords);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.Name = "EditStudent";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Edit Student";
            ((System.ComponentModel.ISupportInitialize)(this.btnBack)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnSettings)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbStudentRecords)).EndInit();
            this.panelStudentRec.ResumeLayout(false);
            this.panelStudentRec.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbStatus)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbProgram)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbName)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbPfp)).EndInit();
            this.panelPfp.ResumeLayout(false);
            this.panelPfp.PerformLayout();
            this.panelEditStud.ResumeLayout(false);
            this.panelEditStud.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.PictureBox btnBack;
        private System.Windows.Forms.PictureBox btnSettings;
        private System.Windows.Forms.PictureBox pbStudentRecords;
        private System.Windows.Forms.Panel panelStudentRec;
        private System.Windows.Forms.Label lblPfp;
        private System.Windows.Forms.Button btnPfp;
        private System.Windows.Forms.PictureBox pbPfp;
        private System.Windows.Forms.ComboBox cboProgram;
        private System.Windows.Forms.Button btnSave;
        private System.Windows.Forms.ComboBox cboStatus;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.PictureBox pbStatus;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.PictureBox pbProgram;
        private System.Windows.Forms.TextBox tbName;
        private System.Windows.Forms.Label lblName;
        private System.Windows.Forms.PictureBox pbName;
        private System.Windows.Forms.Panel panelPfp;
        private System.Windows.Forms.Label lblEditStud;
        private System.Windows.Forms.Panel panelEditStud;
    }
}