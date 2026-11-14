using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using MySql.Data.MySqlClient; // import for sql connection
using QRCoder; // import for generating qr code

// ADD STUDENT PAGE
namespace SmartScan_ID_System_Project
{
    public partial class AddStudent : Form
    {
        private string studentId;

        public AddStudent()
        {
            InitializeComponent();
        }

        // SETTINGS
        private void btnSettings_Click(object sender, EventArgs e)
        {
            Settings settings = new Settings();
            settings.ShowDialog();
        }

        // BACK BUTTON TO STUDENT RECORDS
        private void btnBack_Click(object sender, EventArgs e)
        {
            this.Close();
        }

        // UPLOAD PROFILE PICTURE
        private void btnPfp_Click(object sender, EventArgs e)
        {

            openFileDialog1.Filter = "Image Files|*.jpg;*.jpeg;*.png;*.gif";

            if (openFileDialog1.ShowDialog() == DialogResult.OK)
            {
                pbPfp.Image = Image.FromFile(openFileDialog1.FileName);
            }
        }

        // ADD STUDENT BUTTON
        private void btnAddStudent_Click(object sender, EventArgs e)
        {
            if (tbName.Text == "" || tbStudID.Text == "" || cboProgram.Text == ""
                || cboStatus.Text == "" || pbPfp.Image == null)
            {
                MessageBox.Show("Please fill out all needed information.", "Registration failed", // error handling
                MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            else
            {
                string folderPath = Path.Combine(Application.StartupPath, "Resources", "profiles");
                if (!Directory.Exists(folderPath))
                    Directory.CreateDirectory(folderPath); // ensure folder exists

                string fileName = tbStudID.Text + ".jpg";
                string imagePath = Path.Combine(folderPath, fileName);

                string filePath = Path.Combine(folderPath, tbStudID.Text + ".jpg");
                pbPfp.Image.Save(filePath);

                string connection = "server=localhost;user=root;password=;database=SmartScanDB";
                String query = "INSERT INTO Students (student_id, student_name, course, student_status,profile_picture_path) VALUES (@studid, @name, @program, @status,@profilepicturepath);";

                // using the methods from the MySql.Data.MySqlClient
                using (MySqlConnection conn = new MySqlConnection(connection))
                {
                    try
                    {
                        // checks if student is successfully added
                        conn.Open();

                        using (MySqlCommand cmd = new MySqlCommand(query, conn))
                        {
                            // insert parameters for the sql 
                            cmd.Parameters.AddWithValue("@studid", tbStudID.Text);
                            cmd.Parameters.AddWithValue("@name", tbName.Text);
                            cmd.Parameters.AddWithValue("@program", cboProgram.Text);
                            cmd.Parameters.AddWithValue("@status", cboStatus.Text);
                            cmd.Parameters.AddWithValue("@profilepicturepath", imagePath);
                         
                            int affectedRows = cmd.ExecuteNonQuery();

                            if (affectedRows > 0)
                            {
                                MessageBox.Show("Student Successfully added.", "Register Success",
                                MessageBoxButtons.OK, MessageBoxIcon.Information);

                                // display student id in qr section
                                lblStudentDisplayID.Text = tbStudID.Text;

                                // creates a qr generator
                                QRCodeGenerator qrCodeGenerator = new QRCodeGenerator();
                                QRCodeData codeData = qrCodeGenerator.CreateQrCode(tbStudID.Text, QRCodeGenerator.ECCLevel.Q);
                                QRCode qrCode = new QRCode(codeData);
                                Bitmap qrCodeImage = qrCode.GetGraphic(10, Color.Black, Color.White, true);

                                pbQRCode.Image = qrCodeImage;
                                studentId = tbStudID.Text; // display the corresponding student id

                                // clear previous inputs
                                tbName.Clear();
                                tbStudID.Clear();
                                cboProgram.SelectedIndex = -1;
                                cboStatus.SelectedIndex = -1;
                                pbPfp.Image = null;
                            }
                            else
                            {
                                MessageBox.Show("Failed to register student. Check database constraints.", "Database error",
                                MessageBoxButtons.OK, MessageBoxIcon.Error);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        // handle specific database errors 
                        MessageBox.Show($"Database Error: {ex.Message}", "Connection/Query Error",
                                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }

                }
            }
        }

        // DOWNLOAD QR BUTTON
        private void btnDownloadQR_Click(object sender, EventArgs e)
        {
            // check if image exists
            if (pbQRCode.Image == null)
            {
                MessageBox.Show("No QR code image has been generated yet.", "Error",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            // create and configure save dialog
            using (SaveFileDialog saveFileDialog = new SaveFileDialog())
            {
                saveFileDialog.FileName = studentId + ".png";
                saveFileDialog.Title = "Save QR Code Image";
                saveFileDialog.Filter = "PNG Image (*.png)|*.png|All files (*.*)|*.*";

                if (saveFileDialog.ShowDialog() == DialogResult.OK)
                {
                    try
                    {
                        // save image
                        pbQRCode.Image.Save(saveFileDialog.FileName, System.Drawing.Imaging.ImageFormat.Png);

                        MessageBox.Show($"QR Code successfully saved as:\n{saveFileDialog.FileName}",
                            "QR Code Saved", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show($"Error saving file: {ex.Message}",
                            "Save Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                }
            }
        }
    }
}
