using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

// ADD STUDENT PAGE
namespace SmartScan_ID_System_Project
{
    public partial class AddStudent : Form
    {
        public AddStudent()
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

        // BACK BUTTON TO STUDENT RECORDS
        private void btnBackAdmin_Click(object sender, EventArgs e)
        {
            StudentRecords studRecords = new StudentRecords();
            studRecords.Show();

            this.Close();
        }
    }
}
