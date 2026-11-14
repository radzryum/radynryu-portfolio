using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

// STUDENT RECORDS PAGE
namespace SmartScan_ID_System_Project
{
    public partial class StudentRecords : Form
    {
        public StudentRecords()
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

        // BACK BUTTON TO DASHBOARD
        private void btnBackAdmin_Click(object sender, EventArgs e)
        {
            Dashboard dashboard = new Dashboard();
            dashboard.Show();

            this.Close();
        }

        // ADD STUDENT
        private void btnAdd_Click(object sender, EventArgs e)
        {
            AddStudent addStudent = new AddStudent(); 
            addStudent.Show();

            this.Close();
        }
    }
}