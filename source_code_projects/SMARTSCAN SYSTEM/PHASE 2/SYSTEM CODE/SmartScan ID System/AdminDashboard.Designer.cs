namespace SmartScan_ID_System_Project
{
    partial class AdminDashboard
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
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(AdminDashboard));
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle1 = new System.Windows.Forms.DataGridViewCellStyle();
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle2 = new System.Windows.Forms.DataGridViewCellStyle();
            this.panelAdmin = new System.Windows.Forms.Panel();
            this.cboStatus = new System.Windows.Forms.ComboBox();
            this.lblStatus = new System.Windows.Forms.Label();
            this.pbStatus = new System.Windows.Forms.PictureBox();
            this.lblSubmissions = new System.Windows.Forms.Label();
            this.lblIrregular = new System.Windows.Forms.Label();
            this.lblRegular = new System.Windows.Forms.Label();
            this.tbStudentNum = new System.Windows.Forms.TextBox();
            this.lblStudentNum = new System.Windows.Forms.Label();
            this.pbStudentNum = new System.Windows.Forms.PictureBox();
            this.tbName = new System.Windows.Forms.TextBox();
            this.dpToDate = new System.Windows.Forms.DateTimePicker();
            this.dpFromDate = new System.Windows.Forms.DateTimePicker();
            this.btnStudentsList = new System.Windows.Forms.PictureBox();
            this.btnFilter = new System.Windows.Forms.PictureBox();
            this.lblFromDate = new System.Windows.Forms.Label();
            this.lblName = new System.Windows.Forms.Label();
            this.lblToDate = new System.Windows.Forms.Label();
            this.btnPrint = new System.Windows.Forms.PictureBox();
            this.imageSubmissions = new System.Windows.Forms.PictureBox();
            this.imageIrregular = new System.Windows.Forms.PictureBox();
            this.imageRegular = new System.Windows.Forms.PictureBox();
            this.pbFromDate = new System.Windows.Forms.PictureBox();
            this.pbToDate = new System.Windows.Forms.PictureBox();
            this.pbName = new System.Windows.Forms.PictureBox();
            this.panelHeader = new System.Windows.Forms.Panel();
            this.lblStatusHeader = new System.Windows.Forms.Label();
            this.lblSubDateHeader = new System.Windows.Forms.Label();
            this.lblIDHeader = new System.Windows.Forms.Label();
            this.lblRefHeader = new System.Windows.Forms.Label();
            this.lblNameHeader = new System.Windows.Forms.Label();
            this.dgvHistoryTable = new System.Windows.Forms.DataGridView();
            this.label6 = new System.Windows.Forms.Label();
            this.lblRefNo = new System.Windows.Forms.Label();
            this.label4 = new System.Windows.Forms.Label();
            this.btnSettings = new System.Windows.Forms.PictureBox();
            this.pbLogo = new System.Windows.Forms.PictureBox();
            this.panelAdmin.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbStatus)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbStudentNum)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnStudentsList)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnFilter)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnPrint)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.imageSubmissions)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.imageIrregular)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.imageRegular)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbFromDate)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbToDate)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbName)).BeginInit();
            this.panelHeader.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.dgvHistoryTable)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnSettings)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbLogo)).BeginInit();
            this.SuspendLayout();
            // 
            // panelAdmin
            // 
            this.panelAdmin.BackColor = System.Drawing.Color.MediumSeaGreen;
            this.panelAdmin.Controls.Add(this.cboStatus);
            this.panelAdmin.Controls.Add(this.lblStatus);
            this.panelAdmin.Controls.Add(this.pbStatus);
            this.panelAdmin.Controls.Add(this.lblSubmissions);
            this.panelAdmin.Controls.Add(this.lblIrregular);
            this.panelAdmin.Controls.Add(this.lblRegular);
            this.panelAdmin.Controls.Add(this.tbStudentNum);
            this.panelAdmin.Controls.Add(this.lblStudentNum);
            this.panelAdmin.Controls.Add(this.pbStudentNum);
            this.panelAdmin.Controls.Add(this.tbName);
            this.panelAdmin.Controls.Add(this.dpToDate);
            this.panelAdmin.Controls.Add(this.dpFromDate);
            this.panelAdmin.Controls.Add(this.btnStudentsList);
            this.panelAdmin.Controls.Add(this.btnFilter);
            this.panelAdmin.Controls.Add(this.lblFromDate);
            this.panelAdmin.Controls.Add(this.lblName);
            this.panelAdmin.Controls.Add(this.lblToDate);
            this.panelAdmin.Controls.Add(this.btnPrint);
            this.panelAdmin.Controls.Add(this.imageSubmissions);
            this.panelAdmin.Controls.Add(this.imageIrregular);
            this.panelAdmin.Controls.Add(this.imageRegular);
            this.panelAdmin.Controls.Add(this.pbFromDate);
            this.panelAdmin.Controls.Add(this.pbToDate);
            this.panelAdmin.Controls.Add(this.pbName);
            this.panelAdmin.Location = new System.Drawing.Point(-1, 163);
            this.panelAdmin.Name = "panelAdmin";
            this.panelAdmin.Size = new System.Drawing.Size(1372, 187);
            this.panelAdmin.TabIndex = 1;
            // 
            // cboStatus
            // 
            this.cboStatus.FormattingEnabled = true;
            this.cboStatus.Items.AddRange(new object[] {
            "regular",
            "irregular"});
            this.cboStatus.Location = new System.Drawing.Point(424, 144);
            this.cboStatus.Name = "cboStatus";
            this.cboStatus.Size = new System.Drawing.Size(116, 24);
            this.cboStatus.TabIndex = 23;
            // 
            // lblStatus
            // 
            this.lblStatus.AutoSize = true;
            this.lblStatus.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblStatus.ForeColor = System.Drawing.Color.White;
            this.lblStatus.Location = new System.Drawing.Point(422, 118);
            this.lblStatus.Name = "lblStatus";
            this.lblStatus.Size = new System.Drawing.Size(72, 21);
            this.lblStatus.TabIndex = 21;
            this.lblStatus.Text = "Status:";
            // 
            // pbStatus
            // 
            this.pbStatus.Image = ((System.Drawing.Image)(resources.GetObject("pbStatus.Image")));
            this.pbStatus.Location = new System.Drawing.Point(417, 132);
            this.pbStatus.Name = "pbStatus";
            this.pbStatus.Size = new System.Drawing.Size(128, 38);
            this.pbStatus.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbStatus.TabIndex = 22;
            this.pbStatus.TabStop = false;
            // 
            // lblSubmissions
            // 
            this.lblSubmissions.AutoSize = true;
            this.lblSubmissions.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(255)))), ((int)(((byte)(192)))));
            this.lblSubmissions.Font = new System.Drawing.Font("Arial Rounded MT Bold", 13.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblSubmissions.ForeColor = System.Drawing.Color.MidnightBlue;
            this.lblSubmissions.Location = new System.Drawing.Point(801, 37);
            this.lblSubmissions.Name = "lblSubmissions";
            this.lblSubmissions.Size = new System.Drawing.Size(26, 27);
            this.lblSubmissions.TabIndex = 20;
            this.lblSubmissions.Text = "0";
            // 
            // lblIrregular
            // 
            this.lblIrregular.AutoSize = true;
            this.lblIrregular.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(255)))), ((int)(((byte)(192)))));
            this.lblIrregular.Font = new System.Drawing.Font("Arial Rounded MT Bold", 13.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblIrregular.ForeColor = System.Drawing.Color.Maroon;
            this.lblIrregular.Location = new System.Drawing.Point(599, 37);
            this.lblIrregular.Name = "lblIrregular";
            this.lblIrregular.Size = new System.Drawing.Size(26, 27);
            this.lblIrregular.TabIndex = 19;
            this.lblIrregular.Text = "0";
            // 
            // lblRegular
            // 
            this.lblRegular.AutoSize = true;
            this.lblRegular.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(255)))), ((int)(((byte)(192)))));
            this.lblRegular.Font = new System.Drawing.Font("Arial Rounded MT Bold", 13.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblRegular.ForeColor = System.Drawing.Color.DarkGreen;
            this.lblRegular.Location = new System.Drawing.Point(392, 37);
            this.lblRegular.Name = "lblRegular";
            this.lblRegular.Size = new System.Drawing.Size(26, 27);
            this.lblRegular.TabIndex = 18;
            this.lblRegular.Text = "0";
            // 
            // tbStudentNum
            // 
            this.tbStudentNum.BackColor = System.Drawing.Color.White;
            this.tbStudentNum.BorderStyle = System.Windows.Forms.BorderStyle.None;
            this.tbStudentNum.Font = new System.Drawing.Font("Arial Rounded MT Bold", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.tbStudentNum.Location = new System.Drawing.Point(290, 146);
            this.tbStudentNum.Name = "tbStudentNum";
            this.tbStudentNum.Size = new System.Drawing.Size(105, 18);
            this.tbStudentNum.TabIndex = 17;
            // 
            // lblStudentNum
            // 
            this.lblStudentNum.AutoSize = true;
            this.lblStudentNum.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblStudentNum.ForeColor = System.Drawing.Color.White;
            this.lblStudentNum.Location = new System.Drawing.Point(279, 118);
            this.lblStudentNum.Name = "lblStudentNum";
            this.lblStudentNum.Size = new System.Drawing.Size(108, 21);
            this.lblStudentNum.TabIndex = 15;
            this.lblStudentNum.Text = "Student ID:";
            // 
            // pbStudentNum
            // 
            this.pbStudentNum.Image = ((System.Drawing.Image)(resources.GetObject("pbStudentNum.Image")));
            this.pbStudentNum.Location = new System.Drawing.Point(274, 132);
            this.pbStudentNum.Name = "pbStudentNum";
            this.pbStudentNum.Size = new System.Drawing.Size(136, 38);
            this.pbStudentNum.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbStudentNum.TabIndex = 16;
            this.pbStudentNum.TabStop = false;
            // 
            // tbName
            // 
            this.tbName.BackColor = System.Drawing.Color.White;
            this.tbName.BorderStyle = System.Windows.Forms.BorderStyle.None;
            this.tbName.Font = new System.Drawing.Font("Arial Rounded MT Bold", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.tbName.Location = new System.Drawing.Point(36, 147);
            this.tbName.Name = "tbName";
            this.tbName.Size = new System.Drawing.Size(219, 18);
            this.tbName.TabIndex = 14;
            // 
            // dpToDate
            // 
            this.dpToDate.CalendarMonthBackground = System.Drawing.Color.White;
            this.dpToDate.CalendarTitleBackColor = System.Drawing.Color.White;
            this.dpToDate.Font = new System.Drawing.Font("Arial Rounded MT Bold", 7.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.dpToDate.Location = new System.Drawing.Point(792, 146);
            this.dpToDate.Name = "dpToDate";
            this.dpToDate.Size = new System.Drawing.Size(200, 23);
            this.dpToDate.TabIndex = 13;
            // 
            // dpFromDate
            // 
            this.dpFromDate.CalendarMonthBackground = System.Drawing.Color.White;
            this.dpFromDate.CalendarTitleBackColor = System.Drawing.Color.White;
            this.dpFromDate.Font = new System.Drawing.Font("Arial Rounded MT Bold", 7.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.dpFromDate.Location = new System.Drawing.Point(561, 144);
            this.dpFromDate.Name = "dpFromDate";
            this.dpFromDate.Size = new System.Drawing.Size(200, 23);
            this.dpFromDate.TabIndex = 12;
            // 
            // btnStudentsList
            // 
            this.btnStudentsList.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnStudentsList.Image = global::SmartScan_ID_System_Project.Properties.Resources.studentsList;
            this.btnStudentsList.Location = new System.Drawing.Point(1191, 131);
            this.btnStudentsList.Name = "btnStudentsList";
            this.btnStudentsList.Size = new System.Drawing.Size(158, 41);
            this.btnStudentsList.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.btnStudentsList.TabIndex = 11;
            this.btnStudentsList.TabStop = false;
            this.btnStudentsList.Click += new System.EventHandler(this.btnStudentsList_Click);
            // 
            // btnFilter
            // 
            this.btnFilter.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnFilter.Image = global::SmartScan_ID_System_Project.Properties.Resources.filter;
            this.btnFilter.Location = new System.Drawing.Point(1027, 131);
            this.btnFilter.Name = "btnFilter";
            this.btnFilter.Size = new System.Drawing.Size(158, 41);
            this.btnFilter.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.btnFilter.TabIndex = 10;
            this.btnFilter.TabStop = false;
            this.btnFilter.Click += new System.EventHandler(this.btnFilter_Click);
            // 
            // lblFromDate
            // 
            this.lblFromDate.AutoSize = true;
            this.lblFromDate.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblFromDate.ForeColor = System.Drawing.Color.White;
            this.lblFromDate.Location = new System.Drawing.Point(554, 119);
            this.lblFromDate.Name = "lblFromDate";
            this.lblFromDate.Size = new System.Drawing.Size(62, 21);
            this.lblFromDate.TabIndex = 5;
            this.lblFromDate.Text = "From:";
            // 
            // lblName
            // 
            this.lblName.AutoSize = true;
            this.lblName.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblName.ForeColor = System.Drawing.Color.White;
            this.lblName.Location = new System.Drawing.Point(28, 122);
            this.lblName.Name = "lblName";
            this.lblName.Size = new System.Drawing.Size(68, 21);
            this.lblName.TabIndex = 4;
            this.lblName.Text = "Name:";
            // 
            // lblToDate
            // 
            this.lblToDate.AutoSize = true;
            this.lblToDate.Font = new System.Drawing.Font("Arial Rounded MT Bold", 10.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblToDate.ForeColor = System.Drawing.Color.White;
            this.lblToDate.Location = new System.Drawing.Point(785, 123);
            this.lblToDate.Name = "lblToDate";
            this.lblToDate.Size = new System.Drawing.Size(38, 21);
            this.lblToDate.TabIndex = 6;
            this.lblToDate.Text = "To:";
            // 
            // btnPrint
            // 
            this.btnPrint.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnPrint.Image = global::SmartScan_ID_System_Project.Properties.Resources.print;
            this.btnPrint.Location = new System.Drawing.Point(903, 23);
            this.btnPrint.Name = "btnPrint";
            this.btnPrint.Size = new System.Drawing.Size(175, 79);
            this.btnPrint.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.btnPrint.TabIndex = 3;
            this.btnPrint.TabStop = false;
            this.btnPrint.Click += new System.EventHandler(this.btnPrint_Click);
            // 
            // imageSubmissions
            // 
            this.imageSubmissions.Image = global::SmartScan_ID_System_Project.Properties.Resources.totalsubmission;
            this.imageSubmissions.Location = new System.Drawing.Point(700, 23);
            this.imageSubmissions.Name = "imageSubmissions";
            this.imageSubmissions.Size = new System.Drawing.Size(175, 79);
            this.imageSubmissions.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.imageSubmissions.TabIndex = 2;
            this.imageSubmissions.TabStop = false;
            // 
            // imageIrregular
            // 
            this.imageIrregular.Image = global::SmartScan_ID_System_Project.Properties.Resources.irregular;
            this.imageIrregular.Location = new System.Drawing.Point(493, 23);
            this.imageIrregular.Name = "imageIrregular";
            this.imageIrregular.Size = new System.Drawing.Size(175, 79);
            this.imageIrregular.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.imageIrregular.TabIndex = 1;
            this.imageIrregular.TabStop = false;
            // 
            // imageRegular
            // 
            this.imageRegular.Image = global::SmartScan_ID_System_Project.Properties.Resources.regular;
            this.imageRegular.Location = new System.Drawing.Point(290, 23);
            this.imageRegular.Name = "imageRegular";
            this.imageRegular.Size = new System.Drawing.Size(175, 79);
            this.imageRegular.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.imageRegular.TabIndex = 0;
            this.imageRegular.TabStop = false;
            // 
            // pbFromDate
            // 
            this.pbFromDate.Image = ((System.Drawing.Image)(resources.GetObject("pbFromDate.Image")));
            this.pbFromDate.Location = new System.Drawing.Point(547, 133);
            this.pbFromDate.Name = "pbFromDate";
            this.pbFromDate.Size = new System.Drawing.Size(230, 38);
            this.pbFromDate.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbFromDate.TabIndex = 8;
            this.pbFromDate.TabStop = false;
            // 
            // pbToDate
            // 
            this.pbToDate.Image = ((System.Drawing.Image)(resources.GetObject("pbToDate.Image")));
            this.pbToDate.Location = new System.Drawing.Point(778, 134);
            this.pbToDate.Name = "pbToDate";
            this.pbToDate.Size = new System.Drawing.Size(230, 38);
            this.pbToDate.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbToDate.TabIndex = 9;
            this.pbToDate.TabStop = false;
            // 
            // pbName
            // 
            this.pbName.Image = ((System.Drawing.Image)(resources.GetObject("pbName.Image")));
            this.pbName.Location = new System.Drawing.Point(20, 133);
            this.pbName.Name = "pbName";
            this.pbName.Size = new System.Drawing.Size(250, 38);
            this.pbName.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbName.TabIndex = 7;
            this.pbName.TabStop = false;
            // 
            // panelHeader
            // 
            this.panelHeader.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(255)))), ((int)(((byte)(192)))));
            this.panelHeader.Controls.Add(this.lblStatusHeader);
            this.panelHeader.Controls.Add(this.lblSubDateHeader);
            this.panelHeader.Controls.Add(this.lblIDHeader);
            this.panelHeader.Controls.Add(this.lblRefHeader);
            this.panelHeader.Controls.Add(this.lblNameHeader);
            this.panelHeader.Location = new System.Drawing.Point(-1, 350);
            this.panelHeader.Name = "panelHeader";
            this.panelHeader.Size = new System.Drawing.Size(1372, 53);
            this.panelHeader.TabIndex = 2;
            // 
            // lblStatusHeader
            // 
            this.lblStatusHeader.AutoSize = true;
            this.lblStatusHeader.Font = new System.Drawing.Font("Microsoft Sans Serif", 10.8F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblStatusHeader.ForeColor = System.Drawing.Color.DarkOliveGreen;
            this.lblStatusHeader.Location = new System.Drawing.Point(1201, 18);
            this.lblStatusHeader.Name = "lblStatusHeader";
            this.lblStatusHeader.Size = new System.Drawing.Size(67, 22);
            this.lblStatusHeader.TabIndex = 21;
            this.lblStatusHeader.Text = "Status";
            // 
            // lblSubDateHeader
            // 
            this.lblSubDateHeader.AutoSize = true;
            this.lblSubDateHeader.Font = new System.Drawing.Font("Microsoft Sans Serif", 10.8F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblSubDateHeader.ForeColor = System.Drawing.Color.DarkOliveGreen;
            this.lblSubDateHeader.Location = new System.Drawing.Point(890, 17);
            this.lblSubDateHeader.Name = "lblSubDateHeader";
            this.lblSubDateHeader.Size = new System.Drawing.Size(160, 22);
            this.lblSubDateHeader.TabIndex = 19;
            this.lblSubDateHeader.Text = "Submission Date";
            // 
            // lblIDHeader
            // 
            this.lblIDHeader.AutoSize = true;
            this.lblIDHeader.Font = new System.Drawing.Font("Microsoft Sans Serif", 10.8F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblIDHeader.ForeColor = System.Drawing.Color.DarkOliveGreen;
            this.lblIDHeader.Location = new System.Drawing.Point(670, 17);
            this.lblIDHeader.Name = "lblIDHeader";
            this.lblIDHeader.Size = new System.Drawing.Size(66, 22);
            this.lblIDHeader.TabIndex = 18;
            this.lblIDHeader.Text = "ID No.";
            // 
            // lblRefHeader
            // 
            this.lblRefHeader.AutoSize = true;
            this.lblRefHeader.Font = new System.Drawing.Font("Microsoft Sans Serif", 10.8F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblRefHeader.ForeColor = System.Drawing.Color.DarkOliveGreen;
            this.lblRefHeader.Location = new System.Drawing.Point(100, 17);
            this.lblRefHeader.Name = "lblRefHeader";
            this.lblRefHeader.Size = new System.Drawing.Size(78, 22);
            this.lblRefHeader.TabIndex = 17;
            this.lblRefHeader.Text = "Ref No.";
            // 
            // lblNameHeader
            // 
            this.lblNameHeader.AutoSize = true;
            this.lblNameHeader.Font = new System.Drawing.Font("Microsoft Sans Serif", 10.8F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblNameHeader.ForeColor = System.Drawing.Color.DarkOliveGreen;
            this.lblNameHeader.Location = new System.Drawing.Point(385, 17);
            this.lblNameHeader.Name = "lblNameHeader";
            this.lblNameHeader.Size = new System.Drawing.Size(61, 22);
            this.lblNameHeader.TabIndex = 16;
            this.lblNameHeader.Text = "Name";
            // 
            // dgvHistoryTable
            // 
            this.dgvHistoryTable.AllowUserToAddRows = false;
            this.dgvHistoryTable.AllowUserToDeleteRows = false;
            this.dgvHistoryTable.AllowUserToResizeColumns = false;
            this.dgvHistoryTable.AllowUserToResizeRows = false;
            this.dgvHistoryTable.AutoSizeColumnsMode = System.Windows.Forms.DataGridViewAutoSizeColumnsMode.Fill;
            this.dgvHistoryTable.BackgroundColor = System.Drawing.Color.White;
            this.dgvHistoryTable.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
            this.dgvHistoryTable.ColumnHeadersVisible = false;
            dataGridViewCellStyle1.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleCenter;
            dataGridViewCellStyle1.BackColor = System.Drawing.SystemColors.Window;
            dataGridViewCellStyle1.Font = new System.Drawing.Font("Arial Rounded MT Bold", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle1.ForeColor = System.Drawing.SystemColors.ControlText;
            dataGridViewCellStyle1.SelectionBackColor = System.Drawing.Color.LightGreen;
            dataGridViewCellStyle1.SelectionForeColor = System.Drawing.Color.Black;
            dataGridViewCellStyle1.WrapMode = System.Windows.Forms.DataGridViewTriState.False;
            this.dgvHistoryTable.DefaultCellStyle = dataGridViewCellStyle1;
            this.dgvHistoryTable.Location = new System.Drawing.Point(-1, 404);
            this.dgvHistoryTable.Name = "dgvHistoryTable";
            this.dgvHistoryTable.ReadOnly = true;
            dataGridViewCellStyle2.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleCenter;
            dataGridViewCellStyle2.BackColor = System.Drawing.SystemColors.Control;
            dataGridViewCellStyle2.Font = new System.Drawing.Font("Arial Rounded MT Bold", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle2.ForeColor = System.Drawing.SystemColors.WindowText;
            dataGridViewCellStyle2.SelectionBackColor = System.Drawing.Color.LightGreen;
            dataGridViewCellStyle2.SelectionForeColor = System.Drawing.Color.Black;
            dataGridViewCellStyle2.WrapMode = System.Windows.Forms.DataGridViewTriState.True;
            this.dgvHistoryTable.RowHeadersDefaultCellStyle = dataGridViewCellStyle2;
            this.dgvHistoryTable.RowHeadersVisible = false;
            this.dgvHistoryTable.RowHeadersWidth = 51;
            this.dgvHistoryTable.RowTemplate.Height = 24;
            this.dgvHistoryTable.Size = new System.Drawing.Size(1372, 334);
            this.dgvHistoryTable.TabIndex = 3;
            // 
            // label6
            // 
            this.label6.AutoSize = true;
            this.label6.Font = new System.Drawing.Font("Microsoft Sans Serif", 10.8F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label6.ForeColor = System.Drawing.Color.Black;
            this.label6.Location = new System.Drawing.Point(117, 18);
            this.label6.Name = "label6";
            this.label6.Size = new System.Drawing.Size(78, 22);
            this.label6.TabIndex = 17;
            this.label6.Text = "Ref No.";
            // 
            // lblRefNo
            // 
            this.lblRefNo.AutoSize = true;
            this.lblRefNo.Font = new System.Drawing.Font("Microsoft Sans Serif", 10.8F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblRefNo.ForeColor = System.Drawing.Color.Black;
            this.lblRefNo.Location = new System.Drawing.Point(117, 18);
            this.lblRefNo.Name = "lblRefNo";
            this.lblRefNo.Size = new System.Drawing.Size(78, 22);
            this.lblRefNo.TabIndex = 17;
            this.lblRefNo.Text = "Ref No.";
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Font = new System.Drawing.Font("Microsoft Sans Serif", 10.8F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label4.ForeColor = System.Drawing.Color.Black;
            this.label4.Location = new System.Drawing.Point(1201, 18);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(67, 22);
            this.label4.TabIndex = 21;
            this.label4.Text = "Status";
            // 
            // btnSettings
            // 
            this.btnSettings.Cursor = System.Windows.Forms.Cursors.Hand;
            this.btnSettings.Image = global::SmartScan_ID_System_Project.Properties.Resources.settings;
            this.btnSettings.Location = new System.Drawing.Point(1309, 12);
            this.btnSettings.Name = "btnSettings";
            this.btnSettings.Size = new System.Drawing.Size(50, 50);
            this.btnSettings.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.btnSettings.TabIndex = 4;
            this.btnSettings.TabStop = false;
            this.btnSettings.Click += new System.EventHandler(this.btnSettings_Click);
            // 
            // pbLogo
            // 
            this.pbLogo.Image = global::SmartScan_ID_System_Project.Properties.Resources.admin_dashboard;
            this.pbLogo.Location = new System.Drawing.Point(-1, -6);
            this.pbLogo.Name = "pbLogo";
            this.pbLogo.Size = new System.Drawing.Size(1372, 172);
            this.pbLogo.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pbLogo.TabIndex = 0;
            this.pbLogo.TabStop = false;
            // 
            // AdminDashboard
            // 
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.None;
            this.ClientSize = new System.Drawing.Size(1370, 734);
            this.Controls.Add(this.btnSettings);
            this.Controls.Add(this.dgvHistoryTable);
            this.Controls.Add(this.panelHeader);
            this.Controls.Add(this.panelAdmin);
            this.Controls.Add(this.pbLogo);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.Name = "AdminDashboard";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Admin Dashboard";
            this.panelAdmin.ResumeLayout(false);
            this.panelAdmin.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pbStatus)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbStudentNum)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnStudentsList)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnFilter)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnPrint)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.imageSubmissions)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.imageIrregular)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.imageRegular)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbFromDate)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbToDate)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbName)).EndInit();
            this.panelHeader.ResumeLayout(false);
            this.panelHeader.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.dgvHistoryTable)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.btnSettings)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pbLogo)).EndInit();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.PictureBox pbLogo;
        private System.Windows.Forms.Panel panelAdmin;
        private System.Windows.Forms.PictureBox imageRegular;
        private System.Windows.Forms.PictureBox imageIrregular;
        private System.Windows.Forms.PictureBox btnPrint;
        private System.Windows.Forms.Label lblToDate;
        private System.Windows.Forms.Label lblFromDate;
        private System.Windows.Forms.Label lblName;
        private System.Windows.Forms.PictureBox pbName;
        private System.Windows.Forms.PictureBox pbFromDate;
        private System.Windows.Forms.PictureBox btnFilter;
        private System.Windows.Forms.PictureBox pbToDate;
        private System.Windows.Forms.PictureBox btnStudentsList;
        private System.Windows.Forms.DateTimePicker dpFromDate;
        private System.Windows.Forms.Panel panelHeader;
        private System.Windows.Forms.TextBox tbName;
        private System.Windows.Forms.DateTimePicker dpToDate;
        private System.Windows.Forms.Label lblSubDateHeader;
        private System.Windows.Forms.Label lblIDHeader;
        private System.Windows.Forms.Label lblRefHeader;
        private System.Windows.Forms.Label lblNameHeader;
        private System.Windows.Forms.DataGridView dgvHistoryTable;
        private System.Windows.Forms.PictureBox btnSettings;
        private System.Windows.Forms.PictureBox imageSubmissions;
        private System.Windows.Forms.Label lblStatusHeader;
        private System.Windows.Forms.TextBox tbStudentNum;
        private System.Windows.Forms.Label lblStudentNum;
        private System.Windows.Forms.PictureBox pbStudentNum;
        private System.Windows.Forms.Label lblRegular;
        private System.Windows.Forms.Label lblSubmissions;
        private System.Windows.Forms.Label lblIrregular;
        private System.Windows.Forms.Label label6;
        private System.Windows.Forms.Label lblRefNo;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.ComboBox cboStatus;
        private System.Windows.Forms.Label lblStatus;
        private System.Windows.Forms.PictureBox pbStatus;
    }
}