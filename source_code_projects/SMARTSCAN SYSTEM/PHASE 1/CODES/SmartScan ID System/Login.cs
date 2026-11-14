using System;
using System.Windows.Forms;

// FIRST PAGE(FORM) TO INITIALIZE IN THIS SYSTEM
namespace SmartScan_ID_System_Project
{

    // LOGIN PAGE
    public partial class LoginPage : Form
    {
        // for enabling other forms to call and initialize this page
        public LoginPage()
        {
            InitializeComponent();
        }

        // LOGIN BUTTON
        private void btnLogin_Click(object sender, EventArgs e)
        {
            string username = tbUsername.Text;
            string password = tbPassword.Text;

            // placeholder login credentials - to be replaced with database verification later
            if (username == "admin" && password == "admin123")
            {
                this.Hide();

                Dashboard dashboard = new Dashboard();
                dashboard.Show();
            }
            else if (username == "student" && password == "student123")
            {
                this.Hide();

                ViewDataPage viewData = new ViewDataPage();
                viewData.Show();
            }
            else
            {
                MessageBox.Show("Invalid username or password!", "Login Failed",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}