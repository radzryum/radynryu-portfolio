using MySql.Data.MySqlClient;   
using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

// EDIT PAGE
namespace SmartScan_ID_System_Project
{
    public partial class EditStudent : Form
    {
        // initialize variables
        private System.Windows.Forms.OpenFileDialog openFileDialog;
        private string connection = "server=localhost;user=root;password=;database=SmartScanDB";
        private int student_id;
        private string student_name;
        private string course;
        private string status;

        public EditStudent(int student_id, string student_name, string course, string status)
        {
            InitializeComponent();

            // retrieve the values of the student data to be modified from the student record page
            this.student_id = student_id;
            this.student_name = student_name;
            this.course = course;
            this.status = status;
        }

        // SETTINGS
        private void btnSettings_Click(object sender, EventArgs e)
        {
            Settings settings = new Settings();
            settings.ShowDialog(); // show settings window
        }

        // BACK BUTTON TO DASHBOARD
        private void btnBack_Click(object sender, EventArgs e)
        {
            this.Close();
        }

        // SAVE BUTTON
        private void btnSave_Click(object sender, EventArgs e)
        {
            try
            {
                using (MySqlConnection conn = new MySqlConnection(connection))
                {
                    conn.Open();

                    // If fields are empty, retain old data
                    string newName = string.IsNullOrWhiteSpace(tbName.Text) ? student_name : tbName.Text;
                    string newCourse = string.IsNullOrWhiteSpace(cboProgram.Text) ? course : cboProgram.Text;
                    string newStatus = string.IsNullOrWhiteSpace(cboStatus.Text) ? status : cboStatus.Text;

                    // Update student information
                    string query = @"UPDATE Students SET 
                     student_name = @name,
                     course = @course,
                     student_status = @status
                     WHERE student_id = @id";

                    using (MySqlCommand cmd = new MySqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@name", newName);
                        cmd.Parameters.AddWithValue("@course", newCourse);
                        cmd.Parameters.AddWithValue("@status", newStatus);
                        cmd.Parameters.AddWithValue("@id", student_id);
                        cmd.ExecuteNonQuery();
                    }

                    // Handle profile picture update
                    if (pbPfp.Image != null)
                    {
                        string folderPath = Path.Combine(Application.StartupPath, "Resources", "Profiles");

                        // Ensure directory exists
                        if (!Directory.Exists(folderPath))
                            Directory.CreateDirectory(folderPath);

                        // Delete old image if it exists
                        string oldFileName = student_id.ToString() + ".jpg";
                        string oldImagePath = Path.Combine(folderPath, oldFileName);

                        if (File.Exists(oldImagePath))
                        {
                            try
                            {
                                File.Delete(oldImagePath);
                            }
                            catch (IOException ex)
                            {
                                Console.WriteLine($"Could not delete old image: {ex.Message}");
                            }
                        }

                        // Save new image as JPG
                        string fileName = student_id.ToString() + ".jpg";
                        string newImagePath = Path.Combine(folderPath, fileName);

                        try
                        {
                            // Save the image as JPG
                            pbPfp.Image.Save(newImagePath, System.Drawing.Imaging.ImageFormat.Jpeg);

                            // Update database with new path
                            string relativePath = Path.Combine("Resources", "Profiles", fileName);
                            string updateImageQuery = "UPDATE Students SET profile_picture_path = @imagePath WHERE student_id = @id";

                            using (MySqlCommand updateCmd = new MySqlCommand(updateImageQuery, conn))
                            {
                                updateCmd.Parameters.AddWithValue("@imagePath", relativePath);
                                updateCmd.Parameters.AddWithValue("@id", student_id);
                                updateCmd.ExecuteNonQuery();
                            }
                        }
                        catch (Exception ex)
                        {
                            MessageBox.Show($"Error saving profile picture: {ex.Message}",
                                "Image Save Error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        }
                    }

                    MessageBox.Show("Student updated successfully!", "Success",
                        MessageBoxButtons.OK, MessageBoxIcon.Information);
                    this.Close();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error updating student: {ex.Message}",
                    "Database Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        // UPLOAD NEW PROFILE PICTURE FROM LOCAL FOLDER
        private void btnPfp_Click(object sender, EventArgs e)
        {
            // filters files with the following image compressor
            openFileDialog.Filter = "Image Files|*.jpg;*.jpeg;*.png;*.gif";

            if (openFileDialog.ShowDialog() == DialogResult.OK)
            {
                pbPfp.Image = Image.FromFile(openFileDialog.FileName);
            }

        }
    }
}
