using MySql.Data.MySqlClient;
using System;
using System.Data;
using System.Linq;
using System.Windows.Forms;

// SETTINGS FORM
namespace SmartScan_ID_System_Project
{
    public partial class Settings : Form
    {
        
        private string connectionString = "server=localhost;user=root;password=;database=SmartScanDB";
        public Settings()
        {
            InitializeComponent();
        }
    
        // BACK BUTTON IN SETTINGS
        private void btnBackSettings_Click(object sender, EventArgs e)
        {
            this.Close();
        }

        // QR BUTTON
        private void btnQRScan_Click(object sender, EventArgs e)
        {
            MessageBox.Show("QR mode clicked!", "Information",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
                UpdateScannerMode("QR");
        }

        // STUDENT ID BUTTON
        private void btnBarcode_Click(object sender, EventArgs e)
        {
            MessageBox.Show("Barcode mode clicked!", "Information",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
            UpdateScannerMode("BARCODE");
        }

        // LOGOUT BUTTON
        private void btnLogoutAdmin_Click(object sender, EventArgs e)
        {
            DialogResult result = MessageBox.Show("Are you sure you want to logout?", "Logout Confirmation", MessageBoxButtons.YesNo, MessageBoxIcon.Question);

            if (result == DialogResult.Yes) // if the user agrees to log out
            {
                foreach (Form form in Application.OpenForms.Cast<Form>().ToList()) // iterate through all the forms in the application
                {
                    if (!(form is LoginPage)) // close everything but the login page
                        form.Close();
                }

                LoginPage login = new LoginPage(); // display login page
                login.Show();
            }
        }

        // CONFIGURE SCANNER MODE
        private void UpdateScannerMode(string newMode)
        {
            using (MySqlConnection conn = new MySqlConnection(connectionString))
            {
                // update scanner mode by querying the Scanner_Configuration table
                conn.Open();
                string updateQuery = "UPDATE Scanner_Configuration SET scanner_mode = @mode, last_updated = NOW() WHERE configuration_id = 1";

                using (MySqlCommand cmd = new MySqlCommand(updateQuery, conn))
                {
                    cmd.Parameters.AddWithValue("@mode", newMode);
                    cmd.ExecuteNonQuery();
                }
                MessageBox.Show($"{newMode} mode saved successfully!", "Configuration Saved", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }
    }
}
