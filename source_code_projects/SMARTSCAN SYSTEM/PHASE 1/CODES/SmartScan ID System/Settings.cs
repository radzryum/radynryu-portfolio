using System;
using System.Data;
using System.Linq;
using System.Windows.Forms;

// SETTINGS FORM
namespace SmartScan_ID_System_Project
{
    public partial class Settings : Form
    {
        // to keep track of the previous form so it knows where to go back to
        private Form previous;
        public Settings(Form prev)
        {
            InitializeComponent();
            previous = prev;
        }
    
        // BACK BUTTON IN SETTINGS
        private void btnBackSettings_Click(object sender, EventArgs e)
        {
            previous.Show();

            this.Close();
        }

        // QR BUTTON
        private void btnQRScan_Click(object sender, EventArgs e)
        {
            MessageBox.Show("QR mode clicked!", "Information",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        // STUDENT ID BUTTON
        private void btnBarcode_Click(object sender, EventArgs e)
        {
            MessageBox.Show("Barcode mode clicked!", "Information",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        // LOGOUT BUTTON
        private void btnLogoutAdmin_Click(object sender, EventArgs e)
        {
            DialogResult result = MessageBox.Show("Are you sure you want to logout?", "Logout Confirmation", MessageBoxButtons.YesNo, MessageBoxIcon.Question);

            if (result == DialogResult.Yes)
            {
                foreach (Form form in Application.OpenForms.Cast<Form>().ToList())
                {
                    if (!(form is LoginPage)) // close everything but the login page
                        form.Close();
                }

                LoginPage login = new LoginPage(); // display login page
                login.Show();
            }
        }

        // CLOSE FORM EVENT
        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            base.OnFormClosing(e);

            foreach (Form form in Application.OpenForms)
            {
                if (form is Dashboard)
                {
                    form.Show();
                    break;
                }
            }
        }
    }
}