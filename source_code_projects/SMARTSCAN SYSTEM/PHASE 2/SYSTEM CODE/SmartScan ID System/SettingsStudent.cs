using System;
using System.Linq;
using System.Windows.Forms;

// SETTINGS FOR STUDENT
namespace SmartScan_ID_System_Project
{
    public partial class SettingsStudent : Form
    {
        public SettingsStudent()
        {
            InitializeComponent();
        }

        // BACK BUTTON IN SETTINGS
        private void btnBackSettings_Click(object sender, EventArgs e)
        {
            this.Close();
        }

        // LOGOUT BUTTON
        private void btnLogoutStudent_Click(object sender, EventArgs e)
        {
            DialogResult result = MessageBox.Show("Are you sure you want to logout?", "Logout Confirmation",
                MessageBoxButtons.YesNo, MessageBoxIcon.Question);

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
                if (form is Scanner)
                {
                    form.Show();
                    break;
                }
            }
        }
    }
}