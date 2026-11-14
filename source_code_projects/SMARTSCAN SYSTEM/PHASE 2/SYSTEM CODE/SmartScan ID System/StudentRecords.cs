using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Windows.Forms;

// STUDENT RECORDS PAGE
namespace SmartScan_ID_System_Project
{
    public partial class StudentRecords : Form
    {
        private string connection = "server=localhost; database=SmartScanDB; uid=root; pwd=;";
        public StudentRecords()
        {
            InitializeComponent();
            LoadStudentRecData(); // initialize student records table data upon loading the window
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
            AdminDashboard dashboard = new AdminDashboard();
            dashboard.Show(); // same process

            this.Close();
        }

        // ADD STUDENT
        private void btnAdd_Click(object sender, EventArgs e)
        {
            AddStudent addStudent = new AddStudent(); 
            addStudent.ShowDialog(); // shows a window that blocks interaction with other windows until closed
        }

        // FILTER
        private void btnFilter_Click(object sender, EventArgs e)
        {
            // using the method from the MySql.Data.MySqlClient
            using (MySqlConnection conn = new MySqlConnection(connection))
            {
                conn.Open();

                // query to filter students (in search)
                string query = @"
                                SELECT 
                                    s.course,
                                    s.student_status,
                                    s.registration_date,
                                    s.student_name,
                                    s.student_id
                                FROM Students s
                                WHERE 1=1 "; 

                List<MySqlParameter> parameters = new List<MySqlParameter>(); // store the results in the parameter list

                // if these are true, it would be added in the list:
                if (!string.IsNullOrEmpty(tbName.Text))
                {
                    query += " AND s.student_name LIKE @name"; // add to the query; to specify what to filter, in this case, the name
                    parameters.Add(new MySqlParameter("@name", "%" + tbName.Text + "%")); // add to the parameters list
                }
                if (!string.IsNullOrEmpty(tbStudentNum.Text))
                {
                    query += " AND s.student_id = @studentID"; // filters student id
                    parameters.Add(new MySqlParameter("@studentID", tbStudentNum.Text));
                }
                if (!string.IsNullOrEmpty(cboStatus.Text))
                {
                    query += " AND s.student_status = @status"; // filters student status
                    parameters.Add(new MySqlParameter("@status", cboStatus.Text));
                }
                if (!string.IsNullOrEmpty(cboProgram.Text))
                {
                    query += " AND s.course = @course"; // filters course program
                    parameters.Add(new MySqlParameter("@course", cboProgram.Text));
                }

                DateTime fromDate = dpFromDate.Value.Date;
                DateTime toDate = dpToDate.Value.Date;

                if (fromDate == toDate)
                {
                    query += " AND DATE(s.registration_date) = @fromDate"; // filters "from" date; one date only
                    parameters.Add(new MySqlParameter("@fromDate", fromDate));
                }
                else
                {
                    query += " AND DATE(s.registration_date) BETWEEN @fromDate AND @toDate"; // filters both the "from" and "to" date
                    parameters.Add(new MySqlParameter("@fromDate", fromDate));
                    parameters.Add(new MySqlParameter("@toDate", toDate));
                }

                // add ORDER BY clause
                query += " ORDER BY s.student_id ASC";

                // execute the query
                MySqlDataAdapter da = new MySqlDataAdapter(query, conn);
                foreach (var param in parameters)
                    da.SelectCommand.Parameters.Add(param);

                DataTable dt = new DataTable();
                da.Fill(dt);

                dgvStudentRecTable.DataSource = dt;

                conn.Close();
            }
        }

        // LOAD STUDENT RECORD DATA
        private void LoadStudentRecData()
        {
            // using the method from the MySql.Data.MySqlClient
            using (MySqlConnection conn = new MySqlConnection(connection))
            {
                conn.Open();

                string query = @"
                SELECT 
                    course,
                    student_status,
                    registration_date,
                    student_name,
                    student_id
                FROM Students
                ORDER BY student_id ASC;
                ";

                MySqlDataAdapter da = new MySqlDataAdapter(query, conn);
                DataTable dt = new DataTable();
                da.Fill(dt);

                dgvStudentRecTable.DataSource = dt;

                conn.Close();
            }
        }

        // FOR CLICKING EDIT AND DELETE BUTTON IN THE TABLE
        private void dgvStudentRecTable_CellContentClick(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex < 0) return;

            // EDIT
            if (dgvStudentRecTable.Columns[e.ColumnIndex].Name == "btnEdit") // if the column clicked is the btnEdit...
            {
                // retrieve and convert the values in the column to string
                int student_id = Convert.ToInt32(dgvStudentRecTable.Rows[e.RowIndex].Cells["student_id"].Value);
                string student_name = dgvStudentRecTable.Rows[e.RowIndex].Cells["student_name"].Value.ToString();
                string program = dgvStudentRecTable.Rows[e.RowIndex].Cells["course"].Value.ToString();
                string status = dgvStudentRecTable.Rows[e.RowIndex].Cells["student_status"].Value.ToString();

                // place the values in the Edit Page so it knows what to modify
                EditStudent edit = new EditStudent(student_id, student_name, program, status);
                edit.ShowDialog();

                LoadStudentRecData();
            }

            // DELETE
            if (dgvStudentRecTable.Columns[e.ColumnIndex].Name == "btnDelete") // if the column clicked is the btnDelete...
            {
                // retrieve and convert the student ID in the column to string
                int studentId = Convert.ToInt32(dgvStudentRecTable.Rows[e.RowIndex].Cells["student_id"].Value);

                var confirm = MessageBox.Show("Are you sure you want to delete this student?",
                                               "Confirm Delete", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
                // if the user agrees to delete
                if (confirm == DialogResult.Yes)
                {
                    DeleteStudent(studentId); // call DeleteStudent function
                    LoadStudentRecData(); // reload the student records table
                }
            }
        }

        // DELETE STUDENT FUNCTION
        private void DeleteStudent(int studentId)
        {
            // using the method from the MySql.Data.MySqlClient
            using (MySqlConnection conn = new MySqlConnection(connection))
            {
                conn.Open();

                String imagePathToDelete = null;

                // Delete the profile photo first
                string imagePath = "SELECT profile_picture_path FROM Students WHERE student_id = @id";
                using (MySqlCommand cmdSelect = new MySqlCommand(imagePath, conn))
                {
                    cmdSelect.Parameters.AddWithValue("@id", studentId);
                    object result = cmdSelect.ExecuteScalar();

                    if (result != null && result != DBNull.Value)
                    {
                        imagePathToDelete = result.ToString();
                        File.Delete(imagePathToDelete);
                    }
                }

                // Delete the student information from the Scan_Records second to easily remove them on the Students table
                string deleteScans = "DELETE FROM Scan_Records WHERE student_id = @id";
                using (MySqlCommand cmd = new MySqlCommand(deleteScans, conn))
                {
                    cmd.Parameters.AddWithValue("@id", studentId);
                    cmd.ExecuteNonQuery();
                }

                // Delete all the student information in the Student table last
                string deleteStudent = "DELETE FROM Students WHERE student_id = @id";
                using (MySqlCommand cmd = new MySqlCommand(deleteStudent, conn))
                {
                    cmd.Parameters.AddWithValue("@id", studentId);
                    cmd.ExecuteNonQuery();
                }

                conn.Close();
            }

            // System feedback to inform the user that the system successfully deleted the student from the database
            MessageBox.Show("Student deleted successfully!");
            LoadStudentRecData();
        }
    }
}