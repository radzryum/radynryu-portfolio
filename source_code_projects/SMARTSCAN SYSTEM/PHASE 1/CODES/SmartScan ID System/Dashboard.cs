using System;
using System.Windows.Forms;

// ADMIN DASHBOARD
namespace SmartScan_ID_System_Project
{
    public partial class Dashboard : Form
    {
        public Dashboard()
        {
            InitializeComponent();
        }

        // SETTINGS
        private void btnSettings_Click(object sender, EventArgs e)
        {
            Settings settings = new Settings(this);
            settings.Show();

            this.Hide();
        }

        // FILTER
        private void btnFilter_Click(object sender, EventArgs e)
        {

        }

        // STUDENT RECORDS
        private void btnStudentsList_Click(object sender, EventArgs e)
        {
            this.Close();
            StudentRecords studentRecords = new StudentRecords();
            studentRecords.Show();
        }

        // DATA GRID VIEW
        private void dgvHistoryTable_CellContentClick(object sender, DataGridViewCellEventArgs e)
        {

        }
    }
}