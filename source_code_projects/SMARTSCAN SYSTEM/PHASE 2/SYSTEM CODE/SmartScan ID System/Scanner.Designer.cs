namespace SmartScan_ID_System_Project
{
    partial class Scanner
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
            this.components = new System.ComponentModel.Container();
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle1 = new System.Windows.Forms.DataGridViewCellStyle();
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle2 = new System.Windows.Forms.DataGridViewCellStyle();
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(Scanner));
            this.splitContainer1 = new System.Windows.Forms.SplitContainer();
            this.btnVerifyStudent = new System.Windows.Forms.Button();
            this.tbStudentNum = new System.Windows.Forms.TextBox();
            this.lblStudentNum = new System.Windows.Forms.Label();
            this.panelCamera = new System.Windows.Forms.Panel();
            this.panelStudentVerification = new System.Windows.Forms.Panel();
            this.lblTimeIn = new System.Windows.Forms.Label();
            this.lblProgram = new System.Windows.Forms.Label();
            this.lblStudentIdNumber = new System.Windows.Forms.Label();
            this.lblStudentName = new System.Windows.Forms.Label();
            this.pbStudentPfp = new System.Windows.Forms.PictureBox();
            this.pbBgCard = new System.Windows.Forms.PictureBox();
            this.pbCamera = new System.Windows.Forms.PictureBox();
            this.lblCurrTime = new System.Windows.Forms.Label();
            this.lblCurrDate = new System.Windows.Forms.Label();
            this.pbArrow2 = new System.Windows.Forms.PictureBox();
            this.pbArrow1 = new System.Windows.Forms.PictureBox();
            this.lblHowItWorks = new System.Windows.Forms.Label();
            this.panelVerified = new System.Windows.Forms.Panel();
            this.lblVerified = new System.Windows.Forms.Label();
            this.pbVerified = new System.Windows.Forms.PictureBox();
            this.panelSearch = new System.Windows.Forms.Panel();
            this.lblSearch = new System.Windows.Forms.Label();
            this.pbSearch = new System.Windows.Forms.PictureBox();
            this.panelQR = new System.Windows.Forms.Panel();
            this.lblQR = new System.Windows.Forms.Label();
            this.pbQR = new System.Windows.Forms.PictureBox();
            this.panelScanBg = new System.Windows.Forms.Panel();
            this.lblScanHistory = new System.Windows.Forms.Label();
            this.panelScanTable = new System.Windows.Forms.Panel();
            this.dgvScanHistory = new System.Windows.Forms.DataGridView();
            this.lblRefNum = new System.Windows.Forms.Label();
            this.lblName = new System.Windows.Forms.Label();
            this.lblIDNum = new System.Windows.Forms.Label();
            this.lblTime = new System.Windows.Forms.Label();
            this.timerScan = new System.Windows.Forms.Timer(this.components);
            this.realTimeClock = new System.Windows.Forms.Timer(this.components);
            this.panelLogo = new System.Windows.Forms.Panel();
            this.btnSettings = new System.Windows.Forms.PictureBox();
            this.delayCounter = new System.Windows.Forms.Timer(this.components);
            ((System.ComponentModel.ISupportInitialize)(this.splitContainer1)).BeginInit();
            this.splitContainer1.Panel1.SuspendLayout();
            this.splitContainer1.Panel2.SuspendLayout();
            this.splitContainer1.SuspendLayout();
            this.panelCamera.SuspendLayout();
            this.panelStudentVerification.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbStudentPfp)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbBgCard)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbCamera)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbArrow2)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbArrow1)).BeginInit();
            this.panelVerified.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbVerified)).BeginInit();
            this.panelSearch.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbSearch)).BeginInit();
            this.panelQR.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbQR)).BeginInit();
            this.panelScanBg.SuspendLayout();
            this.panelScanTable.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.dgvScanHistory)).BeginInit();
            this.panelLogo.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.btnSettings)).BeginInit();
            this.SuspendLayout();
            // 
            // splitContainer1
            // 
            this.splitContainer1.Location = new System.Drawing.Point(2, 179);
            this.splitContainer1.Name = "splitContainer1";
            // 
            // splitContainer1.Panel1
            // 
            this.splitContainer1.Panel1.BackColor = System.Drawing.Color.MediumSeaGreen;
            this.splitContainer1.Panel1.Controls.Add(this.btnVerifyStudent);
            this.splitContainer1.Panel1.Controls.Add(this.tbStudentNum);
            this.splitContainer1.Panel1.Controls.Add(this.lblStudentNum);
            this.splitContainer1.Panel1.Controls.Add(this.panelCamera);
            this.splitContainer1.Panel1.Controls.Add(this.lblCurrTime);
            this.splitContainer1.Panel1.Controls.Add(this.lblCurrDate);
            this.splitContainer1.Panel1.Controls.Add(this.pbArrow2);
            this.splitContainer1.Panel1.Controls.Add(this.pbArrow1);
            this.splitContainer1.Panel1.Controls.Add(this.lblHowItWorks);
            this.splitContainer1.Panel1.Controls.Add(this.panelVerified);
            this.splitContainer1.Panel1.Controls.Add(this.panelSearch);
            this.splitContainer1.Panel1.Controls.Add(this.panelQR);
            // 
            // splitContainer1.Panel2
            // 
            this.splitContainer1.Panel2.BackColor = System.Drawing.SystemColors.InactiveBorder;
            this.splitContainer1.Panel2.Controls.Add(this.panelScanBg);
            this.splitContainer1.Panel2.Controls.Add(this.panelScanTable);
            this.splitContainer1.Size = new System.Drawing.Size(1365, 552);
            this.splitContainer1.SplitterDistance = 831;
            this.splitContainer1.TabIndex = 1;
            // 
            // btnVerifyStudent
            // 
            this.btnVerifyStudent.BackColor = System.Drawing.Color.RoyalBlue;
            this.btnVerifyStudent.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnVerifyStudent.FlatAppearance.BorderSize = 0;
            this.btnVerifyStudent.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnVerifyStudent.Font = new System.Drawing.Font("Arial Rounded MT Bold", 7.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.btnVerifyStudent.ForeColor = System.Drawing.SystemColors.ButtonFace;
            this.btnVerifyStudent.Location = new System.Drawing.Point(505, 42);
            this.btnVerifyStudent.Name = "btnVerifyStudent";
            this.btnVerifyStudent.Size = new System.Drawing.Size(75, 23);
            this.btnVerifyStudent.TabIndex = 16;
            this.btnVerifyStudent.Text = "Verify";
            this.btnVerifyStudent.UseVisualStyleBackColor = false;
            this.btnVerifyStudent.Click += new System.EventHandler(this.btnVerifyStudent_Click);
            // 
            // tbStudentNum
            // 
            this.tbStudentNum.Font = new System.Drawing.Font("Arial Rounded MT Bold", 7.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.tbStudentNum.Location = new System.Drawing.Point(311, 44);
            this.tbStudentNum.Name = "tbStudentNum";
            this.tbStudentNum.Size = new System.Drawing.Size(187, 23);
            this.tbStudentNum.TabIndex = 15;
            // 
            // lblStudentNum
            // 
            this.lblStudentNum.AutoSize = true;
            this.lblStudentNum.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblStudentNum.ForeColor = System.Drawing.Color.White;
            this.lblStudentNum.Location = new System.Drawing.Point(212, 45);
            this.lblStudentNum.Name = "lblStudentNum";
            this.lblStudentNum.Size = new System.Drawing.Size(105, 20);
            this.lblStudentNum.TabIndex = 14;
            this.lblStudentNum.Text = "Student No.";
            // 
            // panelCamera
            // 
            this.panelCamera.BackColor = System.Drawing.Color.Honeydew;
            this.panelCamera.Controls.Add(this.panelStudentVerification);
            this.panelCamera.Controls.Add(this.pbCamera);
            this.panelCamera.Location = new System.Drawing.Point(39, 73);
            this.panelCamera.Name = "panelCamera";
            this.panelCamera.Size = new System.Drawing.Size(759, 340);
            this.panelCamera.TabIndex = 13;
            // 
            // panelStudentVerification
            // 
            this.panelStudentVerification.BackColor = System.Drawing.Color.Lime;
            this.panelStudentVerification.Controls.Add(this.lblTimeIn);
            this.panelStudentVerification.Controls.Add(this.lblProgram);
            this.panelStudentVerification.Controls.Add(this.lblStudentIdNumber);
            this.panelStudentVerification.Controls.Add(this.lblStudentName);
            this.panelStudentVerification.Controls.Add(this.pbStudentPfp);
            this.panelStudentVerification.Controls.Add(this.pbBgCard);
            this.panelStudentVerification.Location = new System.Drawing.Point(16, 10);
            this.panelStudentVerification.Name = "panelStudentVerification";
            this.panelStudentVerification.Size = new System.Drawing.Size(729, 320);
            this.panelStudentVerification.TabIndex = 1;
            this.panelStudentVerification.Visible = false;
            // 
            // lblTimeIn
            // 
            this.lblTimeIn.AutoSize = true;
            this.lblTimeIn.BackColor = System.Drawing.Color.Lime;
            this.lblTimeIn.Font = new System.Drawing.Font("Arial Rounded MT Bold", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblTimeIn.ForeColor = System.Drawing.Color.White;
            this.lblTimeIn.Location = new System.Drawing.Point(284, 234);
            this.lblTimeIn.Name = "lblTimeIn";
            this.lblTimeIn.Padding = new System.Windows.Forms.Padding(3);
            this.lblTimeIn.Size = new System.Drawing.Size(92, 29);
            this.lblTimeIn.TabIndex = 5;
            this.lblTimeIn.Text = "Time in:";
            // 
            // lblProgram
            // 
            this.lblProgram.AutoSize = true;
            this.lblProgram.BackColor = System.Drawing.Color.WhiteSmoke;
            this.lblProgram.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblProgram.ForeColor = System.Drawing.Color.OliveDrab;
            this.lblProgram.Location = new System.Drawing.Point(282, 195);
            this.lblProgram.Name = "lblProgram";
            this.lblProgram.Size = new System.Drawing.Size(80, 20);
            this.lblProgram.TabIndex = 4;
            this.lblProgram.Text = "Program";
            // 
            // lblStudentIdNumber
            // 
            this.lblStudentIdNumber.AutoSize = true;
            this.lblStudentIdNumber.BackColor = System.Drawing.Color.WhiteSmoke;
            this.lblStudentIdNumber.Font = new System.Drawing.Font("Arial Rounded MT Bold", 16.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblStudentIdNumber.ForeColor = System.Drawing.Color.OliveDrab;
            this.lblStudentIdNumber.Location = new System.Drawing.Point(282, 152);
            this.lblStudentIdNumber.Name = "lblStudentIdNumber";
            this.lblStudentIdNumber.Size = new System.Drawing.Size(159, 32);
            this.lblStudentIdNumber.TabIndex = 3;
            this.lblStudentIdNumber.Text = "Student ID";
            // 
            // lblStudentName
            // 
            this.lblStudentName.AutoSize = true;
            this.lblStudentName.BackColor = System.Drawing.Color.WhiteSmoke;
            this.lblStudentName.Font = new System.Drawing.Font("Arial Rounded MT Bold", 19.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblStudentName.ForeColor = System.Drawing.Color.OliveDrab;
            this.lblStudentName.Location = new System.Drawing.Point(281, 101);
            this.lblStudentName.Name = "lblStudentName";
            this.lblStudentName.Size = new System.Drawing.Size(111, 38);
            this.lblStudentName.TabIndex = 2;
            this.lblStudentName.Text = "Name";
            // 
            // pbStudentPfp
            // 
            this.pbStudentPfp.BackColor = System.Drawing.Color.MintCream;
            this.pbStudentPfp.Location = new System.Drawing.Point(41, 66);
            this.pbStudentPfp.Name = "pbStudentPfp";
            this.pbStudentPfp.Size = new System.Drawing.Size(207, 203);
            this.pbStudentPfp.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbStudentPfp.TabIndex = 1;
            this.pbStudentPfp.TabStop = false;
            // 
            // pbBgCard
            // 
            this.pbBgCard.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.pbBgCard.Image = global::SmartScan_ID_System_Project.Properties.Resources.bg_display1;
            this.pbBgCard.Location = new System.Drawing.Point(15, 15);
            this.pbBgCard.Name = "pbBgCard";
            this.pbBgCard.Size = new System.Drawing.Size(700, 292);
            this.pbBgCard.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbBgCard.TabIndex = 0;
            this.pbBgCard.TabStop = false;
            // 
            // pbCamera
            // 
            this.pbCamera.Location = new System.Drawing.Point(16, 10);
            this.pbCamera.Name = "pbCamera";
            this.pbCamera.Size = new System.Drawing.Size(729, 320);
            this.pbCamera.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbCamera.TabIndex = 0;
            this.pbCamera.TabStop = false;
            // 
            // lblCurrTime
            // 
            this.lblCurrTime.AutoSize = true;
            this.lblCurrTime.Font = new System.Drawing.Font("Arial Rounded MT Bold", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblCurrTime.ForeColor = System.Drawing.Color.White;
            this.lblCurrTime.Location = new System.Drawing.Point(712, 12);
            this.lblCurrTime.Name = "lblCurrTime";
            this.lblCurrTime.Size = new System.Drawing.Size(58, 23);
            this.lblCurrTime.TabIndex = 12;
            this.lblCurrTime.Text = "Time";
            // 
            // lblCurrDate
            // 
            this.lblCurrDate.AutoSize = true;
            this.lblCurrDate.Font = new System.Drawing.Font("Arial Rounded MT Bold", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblCurrDate.ForeColor = System.Drawing.Color.White;
            this.lblCurrDate.Location = new System.Drawing.Point(35, 12);
            this.lblCurrDate.Name = "lblCurrDate";
            this.lblCurrDate.Size = new System.Drawing.Size(56, 23);
            this.lblCurrDate.TabIndex = 11;
            this.lblCurrDate.Text = "Date";
            // 
            // pbArrow2
            // 
            this.pbArrow2.Image = global::SmartScan_ID_System_Project.Properties.Resources.arrow;
            this.pbArrow2.Location = new System.Drawing.Point(529, 467);
            this.pbArrow2.Name = "pbArrow2";
            this.pbArrow2.Size = new System.Drawing.Size(61, 57);
            this.pbArrow2.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbArrow2.TabIndex = 10;
            this.pbArrow2.TabStop = false;
            // 
            // pbArrow1
            // 
            this.pbArrow1.Image = global::SmartScan_ID_System_Project.Properties.Resources.arrow;
            this.pbArrow1.Location = new System.Drawing.Point(242, 467);
            this.pbArrow1.Name = "pbArrow1";
            this.pbArrow1.Size = new System.Drawing.Size(61, 57);
            this.pbArrow1.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbArrow1.TabIndex = 9;
            this.pbArrow1.TabStop = false;
            // 
            // lblHowItWorks
            // 
            this.lblHowItWorks.AutoSize = true;
            this.lblHowItWorks.Font = new System.Drawing.Font("Arial Rounded MT Bold", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblHowItWorks.ForeColor = System.Drawing.SystemColors.Control;
            this.lblHowItWorks.Location = new System.Drawing.Point(339, 434);
            this.lblHowItWorks.Name = "lblHowItWorks";
            this.lblHowItWorks.Size = new System.Drawing.Size(177, 23);
            this.lblHowItWorks.TabIndex = 4;
            this.lblHowItWorks.Text = "HOW IT WORKS?";
            // 
            // panelVerified
            // 
            this.panelVerified.BackColor = System.Drawing.SystemColors.Control;
            this.panelVerified.Controls.Add(this.lblVerified);
            this.panelVerified.Controls.Add(this.pbVerified);
            this.panelVerified.Location = new System.Drawing.Point(616, 460);
            this.panelVerified.Name = "panelVerified";
            this.panelVerified.Size = new System.Drawing.Size(168, 78);
            this.panelVerified.TabIndex = 3;
            // 
            // lblVerified
            // 
            this.lblVerified.AutoSize = true;
            this.lblVerified.Font = new System.Drawing.Font("Arial Rounded MT Bold", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblVerified.Location = new System.Drawing.Point(46, 57);
            this.lblVerified.Name = "lblVerified";
            this.lblVerified.Size = new System.Drawing.Size(95, 17);
            this.lblVerified.TabIndex = 9;
            this.lblVerified.Text = "Get Verified";
            // 
            // pbVerified
            // 
            this.pbVerified.Image = global::SmartScan_ID_System_Project.Properties.Resources.VERIFIED;
            this.pbVerified.Location = new System.Drawing.Point(62, 11);
            this.pbVerified.Name = "pbVerified";
            this.pbVerified.Size = new System.Drawing.Size(43, 40);
            this.pbVerified.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbVerified.TabIndex = 8;
            this.pbVerified.TabStop = false;
            // 
            // panelSearch
            // 
            this.panelSearch.BackColor = System.Drawing.SystemColors.Control;
            this.panelSearch.Controls.Add(this.lblSearch);
            this.panelSearch.Controls.Add(this.pbSearch);
            this.panelSearch.Location = new System.Drawing.Point(331, 460);
            this.panelSearch.Name = "panelSearch";
            this.panelSearch.Size = new System.Drawing.Size(168, 78);
            this.panelSearch.TabIndex = 3;
            // 
            // lblSearch
            // 
            this.lblSearch.AutoSize = true;
            this.lblSearch.Font = new System.Drawing.Font("Arial Rounded MT Bold", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblSearch.Location = new System.Drawing.Point(21, 57);
            this.lblSearch.Name = "lblSearch";
            this.lblSearch.Size = new System.Drawing.Size(156, 17);
            this.lblSearch.TabIndex = 8;
            this.lblSearch.Text = "Verification Process";
            // 
            // pbSearch
            // 
            this.pbSearch.Image = global::SmartScan_ID_System_Project.Properties.Resources.SEARCH;
            this.pbSearch.Location = new System.Drawing.Point(65, 11);
            this.pbSearch.Name = "pbSearch";
            this.pbSearch.Size = new System.Drawing.Size(40, 40);
            this.pbSearch.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbSearch.TabIndex = 7;
            this.pbSearch.TabStop = false;
            // 
            // panelQR
            // 
            this.panelQR.BackColor = System.Drawing.SystemColors.Control;
            this.panelQR.Controls.Add(this.lblQR);
            this.panelQR.Controls.Add(this.pbQR);
            this.panelQR.Location = new System.Drawing.Point(46, 460);
            this.panelQR.Name = "panelQR";
            this.panelQR.Size = new System.Drawing.Size(168, 78);
            this.panelQR.TabIndex = 2;
            // 
            // lblQR
            // 
            this.lblQR.AutoSize = true;
            this.lblQR.Font = new System.Drawing.Font("Arial Rounded MT Bold", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblQR.Location = new System.Drawing.Point(36, 57);
            this.lblQR.Name = "lblQR";
            this.lblQR.Size = new System.Drawing.Size(114, 17);
            this.lblQR.TabIndex = 7;
            this.lblQR.Text = "Scan QR Code";
            // 
            // pbQR
            // 
            this.pbQR.Image = global::SmartScan_ID_System_Project.Properties.Resources.QR;
            this.pbQR.Location = new System.Drawing.Point(65, 11);
            this.pbQR.Name = "pbQR";
            this.pbQR.Size = new System.Drawing.Size(40, 40);
            this.pbQR.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbQR.TabIndex = 6;
            this.pbQR.TabStop = false;
            // 
            // panelScanBg
            // 
            this.panelScanBg.BackColor = System.Drawing.Color.MediumSeaGreen;
            this.panelScanBg.Controls.Add(this.lblScanHistory);
            this.panelScanBg.Location = new System.Drawing.Point(0, 0);
            this.panelScanBg.Name = "panelScanBg";
            this.panelScanBg.Size = new System.Drawing.Size(530, 67);
            this.panelScanBg.TabIndex = 0;
            // 
            // lblScanHistory
            // 
            this.lblScanHistory.AutoSize = true;
            this.lblScanHistory.Font = new System.Drawing.Font("Arial Rounded MT Bold", 22.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblScanHistory.ForeColor = System.Drawing.SystemColors.Control;
            this.lblScanHistory.Location = new System.Drawing.Point(153, 20);
            this.lblScanHistory.Name = "lblScanHistory";
            this.lblScanHistory.Size = new System.Drawing.Size(302, 43);
            this.lblScanHistory.TabIndex = 0;
            this.lblScanHistory.Text = "SCAN HISTORY";
            // 
            // panelScanTable
            // 
            this.panelScanTable.AutoScroll = true;
            this.panelScanTable.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(255)))), ((int)(((byte)(192)))));
            this.panelScanTable.Controls.Add(this.dgvScanHistory);
            this.panelScanTable.Controls.Add(this.lblRefNum);
            this.panelScanTable.Controls.Add(this.lblName);
            this.panelScanTable.Controls.Add(this.lblIDNum);
            this.panelScanTable.Controls.Add(this.lblTime);
            this.panelScanTable.Location = new System.Drawing.Point(6, 73);
            this.panelScanTable.Name = "panelScanTable";
            this.panelScanTable.Size = new System.Drawing.Size(521, 476);
            this.panelScanTable.TabIndex = 4;
            // 
            // dgvScanHistory
            // 
            this.dgvScanHistory.AllowUserToAddRows = false;
            this.dgvScanHistory.AllowUserToDeleteRows = false;
            this.dgvScanHistory.AllowUserToResizeColumns = false;
            this.dgvScanHistory.AllowUserToResizeRows = false;
            this.dgvScanHistory.AutoSizeColumnsMode = System.Windows.Forms.DataGridViewAutoSizeColumnsMode.Fill;
            this.dgvScanHistory.BackgroundColor = System.Drawing.Color.White;
            dataGridViewCellStyle1.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleLeft;
            dataGridViewCellStyle1.BackColor = System.Drawing.SystemColors.Control;
            dataGridViewCellStyle1.Font = new System.Drawing.Font("Arial Rounded MT Bold", 7.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle1.ForeColor = System.Drawing.SystemColors.WindowText;
            dataGridViewCellStyle1.SelectionBackColor = System.Drawing.Color.PaleGreen;
            dataGridViewCellStyle1.SelectionForeColor = System.Drawing.SystemColors.Desktop;
            dataGridViewCellStyle1.WrapMode = System.Windows.Forms.DataGridViewTriState.True;
            this.dgvScanHistory.ColumnHeadersDefaultCellStyle = dataGridViewCellStyle1;
            this.dgvScanHistory.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
            this.dgvScanHistory.ColumnHeadersVisible = false;
            dataGridViewCellStyle2.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleLeft;
            dataGridViewCellStyle2.BackColor = System.Drawing.SystemColors.Window;
            dataGridViewCellStyle2.Font = new System.Drawing.Font("Arial Rounded MT Bold", 7.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle2.ForeColor = System.Drawing.SystemColors.ControlText;
            dataGridViewCellStyle2.SelectionBackColor = System.Drawing.Color.PaleGreen;
            dataGridViewCellStyle2.SelectionForeColor = System.Drawing.Color.Black;
            dataGridViewCellStyle2.WrapMode = System.Windows.Forms.DataGridViewTriState.True;
            this.dgvScanHistory.DefaultCellStyle = dataGridViewCellStyle2;
            this.dgvScanHistory.Location = new System.Drawing.Point(12, 43);
            this.dgvScanHistory.Name = "dgvScanHistory";
            this.dgvScanHistory.ReadOnly = true;
            this.dgvScanHistory.RowHeadersVisible = false;
            this.dgvScanHistory.RowHeadersWidth = 51;
            this.dgvScanHistory.RowTemplate.Height = 24;
            this.dgvScanHistory.ScrollBars = System.Windows.Forms.ScrollBars.Vertical;
            this.dgvScanHistory.Size = new System.Drawing.Size(500, 418);
            this.dgvScanHistory.TabIndex = 4;
            // 
            // lblRefNum
            // 
            this.lblRefNum.AutoSize = true;
            this.lblRefNum.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblRefNum.ForeColor = System.Drawing.Color.DarkOliveGreen;
            this.lblRefNum.Location = new System.Drawing.Point(42, 14);
            this.lblRefNum.Margin = new System.Windows.Forms.Padding(10, 10, 3, 0);
            this.lblRefNum.Name = "lblRefNum";
            this.lblRefNum.Size = new System.Drawing.Size(69, 20);
            this.lblRefNum.TabIndex = 0;
            this.lblRefNum.Text = "Ref No.";
            // 
            // lblName
            // 
            this.lblName.AutoSize = true;
            this.lblName.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblName.ForeColor = System.Drawing.Color.DarkOliveGreen;
            this.lblName.Location = new System.Drawing.Point(181, 14);
            this.lblName.Margin = new System.Windows.Forms.Padding(100, 10, 3, 0);
            this.lblName.Name = "lblName";
            this.lblName.Size = new System.Drawing.Size(57, 20);
            this.lblName.TabIndex = 1;
            this.lblName.Text = "Name";
            // 
            // lblIDNum
            // 
            this.lblIDNum.AutoSize = true;
            this.lblIDNum.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblIDNum.ForeColor = System.Drawing.Color.DarkOliveGreen;
            this.lblIDNum.Location = new System.Drawing.Point(326, 14);
            this.lblIDNum.Margin = new System.Windows.Forms.Padding(15, 10, 3, 0);
            this.lblIDNum.Name = "lblIDNum";
            this.lblIDNum.Size = new System.Drawing.Size(27, 20);
            this.lblIDNum.TabIndex = 2;
            this.lblIDNum.Text = "ID";
            // 
            // lblTime
            // 
            this.lblTime.AutoSize = true;
            this.lblTime.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.2F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblTime.ForeColor = System.Drawing.Color.DarkOliveGreen;
            this.lblTime.Location = new System.Drawing.Point(423, 14);
            this.lblTime.Margin = new System.Windows.Forms.Padding(15, 10, 3, 0);
            this.lblTime.Name = "lblTime";
            this.lblTime.Size = new System.Drawing.Size(50, 20);
            this.lblTime.TabIndex = 3;
            this.lblTime.Text = "Time";
            // 
            // timerScan
            // 
            this.timerScan.Tick += new System.EventHandler(this.timerScan_Tick);
            // 
            // realTimeClock
            // 
            this.realTimeClock.Tick += new System.EventHandler(this.realTimeClock_Tick);
            // 
            // panelLogo
            // 
            this.panelLogo.BackgroundImage = global::SmartScan_ID_System_Project.Properties.Resources.header;
            this.panelLogo.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
            this.panelLogo.Controls.Add(this.btnSettings);
            this.panelLogo.Location = new System.Drawing.Point(-12, 1);
            this.panelLogo.Name = "panelLogo";
            this.panelLogo.Size = new System.Drawing.Size(1388, 172);
            this.panelLogo.TabIndex = 0;
            // 
            // btnSettings
            // 
            this.btnSettings.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnSettings.Image = global::SmartScan_ID_System_Project.Properties.Resources.settings;
            this.btnSettings.Location = new System.Drawing.Point(1297, 11);
            this.btnSettings.Name = "btnSettings";
            this.btnSettings.Size = new System.Drawing.Size(56, 50);
            this.btnSettings.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.btnSettings.TabIndex = 5;
            this.btnSettings.TabStop = false;
            this.btnSettings.Click += new System.EventHandler(this.btnSettings_Click);
            // 
            // delayCounter
            // 
            this.delayCounter.Tick += new System.EventHandler(this.delayCounter_Tick);
            // 
            // Scanner
            // 
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.None;
            this.ClientSize = new System.Drawing.Size(1371, 734);
            this.Controls.Add(this.splitContainer1);
            this.Controls.Add(this.panelLogo);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.Name = "Scanner";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Scanner Page";
            this.FormClosing += new System.Windows.Forms.FormClosingEventHandler(this.Scanner_FormClosing);
            this.splitContainer1.Panel1.ResumeLayout(false);
            this.splitContainer1.Panel1.PerformLayout();
            this.splitContainer1.Panel2.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.splitContainer1)).EndInit();
            this.splitContainer1.ResumeLayout(false);
            this.panelCamera.ResumeLayout(false);
            this.panelStudentVerification.ResumeLayout(false);
            this.panelStudentVerification.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbStudentPfp)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbBgCard)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbCamera)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbArrow2)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbArrow1)).EndInit();
            this.panelVerified.ResumeLayout(false);
            this.panelVerified.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbVerified)).EndInit();
            this.panelSearch.ResumeLayout(false);
            this.panelSearch.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbSearch)).EndInit();
            this.panelQR.ResumeLayout(false);
            this.panelQR.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbQR)).EndInit();
            this.panelScanBg.ResumeLayout(false);
            this.panelScanBg.PerformLayout();
            this.panelScanTable.ResumeLayout(false);
            this.panelScanTable.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.dgvScanHistory)).EndInit();
            this.panelLogo.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.btnSettings)).EndInit();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Panel panelLogo;
        private System.Windows.Forms.SplitContainer splitContainer1;
        private System.Windows.Forms.Panel panelScanBg;
        private System.Windows.Forms.Panel panelQR;
        private System.Windows.Forms.PictureBox pbQR;
        private System.Windows.Forms.Label lblHowItWorks;
        private System.Windows.Forms.Panel panelVerified;
        private System.Windows.Forms.Panel panelSearch;
        private System.Windows.Forms.PictureBox pbSearch;
        private System.Windows.Forms.PictureBox pbVerified;
        private System.Windows.Forms.PictureBox pbArrow1;
        private System.Windows.Forms.PictureBox pbArrow2;
        private System.Windows.Forms.Label lblQR;
        private System.Windows.Forms.Label lblSearch;
        private System.Windows.Forms.Label lblVerified;
        private System.Windows.Forms.Label lblScanHistory;
        private System.Windows.Forms.Label lblRefNum;
        private System.Windows.Forms.Label lblName;
        private System.Windows.Forms.Label lblIDNum;
        private System.Windows.Forms.Label lblTime;
        private System.Windows.Forms.Label lblCurrDate;
        private System.Windows.Forms.Panel panelScanTable;
        private System.Windows.Forms.DataGridView dgvScanHistory;
        private System.Windows.Forms.Label lblCurrTime;
        private System.Windows.Forms.PictureBox btnSettings;
        private System.Windows.Forms.Panel panelCamera;
        private System.Windows.Forms.Label lblStudentNum;
        private System.Windows.Forms.Button btnVerifyStudent;
        private System.Windows.Forms.TextBox tbStudentNum;
        private System.Windows.Forms.PictureBox pbCamera;
        private System.Windows.Forms.Timer timerScan;
        private System.Windows.Forms.Timer realTimeClock;
        private System.Windows.Forms.Panel panelStudentVerification;
        private System.Windows.Forms.PictureBox pbBgCard;
        private System.Windows.Forms.PictureBox pbStudentPfp;
        private System.Windows.Forms.Label lblStudentName;
        private System.Windows.Forms.Label lblStudentIdNumber;
        private System.Windows.Forms.Label lblTimeIn;
        private System.Windows.Forms.Label lblProgram;
        private System.Windows.Forms.Timer delayCounter;
    }
}