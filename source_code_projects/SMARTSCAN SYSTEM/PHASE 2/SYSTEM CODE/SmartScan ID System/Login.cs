using System;
using System.Windows.Forms;
using MySql.Data.MySqlClient; // import for sql connection

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
            // initialize connection and user credentials
            string connection = "server=localhost; database=SmartScanDB; uid=root; pwd=;";
            string username = tbUsername.Text;
            string password = tbPassword.Text;

            // for authenticating user
           using (MySqlConnection conn = new MySqlConnection(connection))
            {
                try
                {
                    conn.Open(); // open connection
                    string query = "SELECT user_role FROM Users WHERE username = @username AND pass_hash = @password"; // query the users from Users table

                    // using the method from the MySql.Data.MySqlClient
                    using (MySqlCommand cmd = new MySqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@username", username);
                        cmd.Parameters.AddWithValue("@password", password);

                        object result = cmd.ExecuteScalar();

                        if (result != null)
                        {
                            string role = result.ToString();

                            if (role == "admin") // show admin dashboard, hide this (Login) form
                            {
                                AdminDashboard dashboard = new AdminDashboard();
                                dashboard.Show();
                                this.Hide();
                            }
                            else if (role == "student") // show scanner page, hide this (Login) form
                            {
                                Scanner scannerPage = new Scanner();
                                scannerPage.Show();
                                this.Hide();
                            }
                            else
                            {
                                // if it's neither admin and student
                                MessageBox.Show("User does not exist in the database.", "Login Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
                            }
                        }
                        else
                        {
                            // if the result is null
                            MessageBox.Show("Invalid credentials.", "Login Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        }
                    }
                }
                catch (Exception err)
                {
                    // displays if the error is in the server/database
                    MessageBox.Show("Error connecting to database: " + err.Message);
                }
            }
        }

    }
}