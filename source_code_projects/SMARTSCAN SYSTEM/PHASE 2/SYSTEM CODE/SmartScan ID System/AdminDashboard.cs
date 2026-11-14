using MySql.Data.MySqlClient;
using iTextSharp.text;
using iTextSharp.text.pdf;
using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Windows.Forms;

// ADMIN DASHBOARD
namespace SmartScan_ID_System_Project
{
    public partial class AdminDashboard : Form
    {
        private string connection = "server=localhost; database=SmartScanDB; uid=root; pwd=;";
        public AdminDashboard()
        {
            InitializeComponent();
            LoadHistoryData(); // load data upon opening the window
            LoadAnalytics();
        }

        // SETTINGS
        private void btnSettings_Click(object sender, EventArgs e)
        {
            Settings settings = new Settings();
            settings.ShowDialog(); // show admin setting window
        }

        // FILTER
        private void btnFilter_Click(object sender, EventArgs e)
        {
            // using the method from the MySql.Data.MySqlClient
            using (MySqlConnection conn = new MySqlConnection(connection))
            {
                // query to filter students (in search)
                string query = @"
                    SELECT 
                        r.reference_number,
                        s.student_name,
                        r.student_id,
                        r.scan_datetime,
                        s.student_status
                    FROM Scan_Records r
                    LEFT JOIN Students s ON s.student_id = r.student_id
                    WHERE 1=1
                ";

                List<MySqlParameter> parameters = new List<MySqlParameter>();  // store the results in the parameter list

                // if these are true, it would be added in the list:
                if (!string.IsNullOrEmpty(tbName.Text))
                {
                    query += " AND s.student_name LIKE @name"; // add to the query; to specify what to filter, in this case, the name
                    parameters.Add(new MySqlParameter("@name", "%" + tbName.Text + "%")); // add to the parameters list
                }
                if (!string.IsNullOrEmpty(tbStudentNum.Text))
                {
                    query += " AND r.student_id = @studentID"; // filters student id
                    parameters.Add(new MySqlParameter("@studentID", tbStudentNum.Text));
                }
                if (!string.IsNullOrEmpty(cboStatus.Text))
                {
                    query += " AND s.student_status = @status"; // filters student status
                    parameters.Add(new MySqlParameter("@status", cboStatus.Text));
                }

                // initialize date values from the date picker
                DateTime fromDate = dpFromDate.Value.Date;
                DateTime toDate = dpToDate.Value.Date;

                if (fromDate == toDate)
                {
                    query += " AND DATE(r.scan_datetime) = @fromDate"; // filters "from" date; one date only
                    parameters.Add(new MySqlParameter("@fromDate", fromDate));
                }
                else
                {
                    query += " AND DATE(r.scan_datetime) BETWEEN @fromDate AND @toDate"; // filters both the "from" and "to" date
                    parameters.Add(new MySqlParameter("@fromDate", fromDate));
                    parameters.Add(new MySqlParameter("@toDate", toDate));
                }

                MySqlDataAdapter da = new MySqlDataAdapter(query, conn);
                foreach (var param in parameters)
                    da.SelectCommand.Parameters.Add(param);

                DataTable dt = new DataTable();
                da.Fill(dt);

                dgvHistoryTable.DataSource = dt; // place the result of the query in the table
            }
        }

        // STUDENT RECORDS
        private void btnStudentsList_Click(object sender, EventArgs e)
        {
            this.Close();
            StudentRecords studentRecords = new StudentRecords();
            studentRecords.Show();
        }

        // LOAD ANALYTICS
        private void LoadAnalytics()
        {
            // using the method from the MySql.Data.MySqlClient
            using (MySqlConnection conn = new MySqlConnection(connection))
            {
                conn.Open();

                // count the regular students (for the analytics)
                string queryRegular = @"
                    SELECT COUNT(*) 
                    FROM Scan_Records r
                    JOIN Students s ON r.student_id = s.student_id
                    WHERE s.student_status = 'regular';
                ";
                MySqlCommand cmdRegular = new MySqlCommand(queryRegular, conn);
                lblRegular.Text = cmdRegular.ExecuteScalar().ToString(); // display the total count in this label for regulars

                // count the irregular students
                string queryIrregular = @"
                    SELECT COUNT(*) 
                    FROM Scan_Records r
                    JOIN Students s ON r.student_id = s.student_id
                    WHERE s.student_status = 'irregular';
                ";
                MySqlCommand cmdIrregular = new MySqlCommand(queryIrregular, conn);
                lblIrregular.Text = cmdIrregular.ExecuteScalar().ToString(); // display the total count in this label for irregulars

                // count the total of scan records
                string querySubmissions = @"SELECT COUNT(*) FROM Scan_Records;";
                MySqlCommand cmdSubmissions = new MySqlCommand(querySubmissions, conn);
                lblSubmissions.Text = cmdSubmissions.ExecuteScalar().ToString(); // display the total count in this label

                conn.Close();
            }
        }

        // LOAD HISTORY DATA
        private void LoadHistoryData()
        {
            // query the history by accessing the Scan_Records table and the Students table
            using (MySqlConnection conn = new MySqlConnection(connection))
            {
                string query = @"
                SELECT 
                    r.reference_number,
                    s.student_name,
                    r.student_id,
                    r.scan_datetime,
                    s.student_status
                FROM Scan_Records r
                LEFT JOIN Students s ON s.student_id = r.student_id
                ORDER BY r.scan_datetime DESC;
                ";

                MySqlDataAdapter da = new MySqlDataAdapter(query, conn);
                DataTable dt = new DataTable();
                da.Fill(dt);

                dgvHistoryTable.DataSource = dt; // put the result inside the data grid view history table
            }
        }   

        // LOAD STUDENT RECORDS DATA (for printing analytics)
        private DataTable LoadStudentRecData()
        {
            // query the student records by accessing the Scan_Records table and the Students table
            using (MySqlConnection conn = new MySqlConnection(connection))
            {
                string query = @"
                    SELECT 
                        s.course,
                        s.student_status,
                        r.scan_datetime,
                        s.student_name,
                        r.student_id
                    FROM Scan_Records r
                    LEFT JOIN Students s ON s.student_id = r.student_id
                    ORDER BY r.student_id ASC;
                ";
                MySqlDataAdapter da = new MySqlDataAdapter(query, conn);
                DataTable dt = new DataTable();
                da.Fill(dt);
                return dt;
            }
        }

        // PRINT BUTTON - EXPORT TO PDF
        private void btnPrint_Click(object sender, EventArgs e)
        {
            try
            {
                // createn and save new file for the analytics in local folder
                SaveFileDialog saveFile = new SaveFileDialog();
                saveFile.Filter = "PDF files (*.pdf)|*.pdf";
                saveFile.FileName = "Admin_Analytics_Report.pdf";

                if (saveFile.ShowDialog() == DialogResult.OK) // if the user agrees to save
                {
                    using (FileStream stream = new FileStream(saveFile.FileName, FileMode.Create))
                    {
                        //template to print the analytics report
                        Document pdfDoc = new Document(PageSize.A4, 25, 25, 30, 30);
                        PdfWriter.GetInstance(pdfDoc, stream);
                        pdfDoc.Open();

                        // below are the contentsn with basic designs

                        //TITLE
                        Paragraph title = new Paragraph("ADMIN ANALYTICS REPORT",
                            FontFactory.GetFont("Arial", 16, iTextSharp.text.Font.BOLD));
                        title.Alignment = Element.ALIGN_CENTER;
                        pdfDoc.Add(title);
                        pdfDoc.Add(new Paragraph(" ")); // space

                        // ANALYTICS
                        pdfDoc.Add(new Paragraph($"Regular Students: {lblRegular.Text}\n" +
                                                            $"Irregular Students: {lblIrregular.Text}\n" +
                                                            $"Total Submissions: {lblSubmissions.Text}\n\n",
                                                            FontFactory.GetFont("Arial", 12)));

                        // STUDENT RECORDS TABLE
                        DataTable studentRecData = LoadStudentRecData();

                        pdfDoc.Add(new Paragraph("Student Records:", FontFactory.GetFont("Arial", 12, iTextSharp.text.Font.BOLD)));
                        pdfDoc.Add(new Paragraph(" "));

                        pdfDoc.Add(printTable(studentRecData));
                        pdfDoc.Add(new Paragraph(" "));

                        // SCAN HISTORY TABLE
                        DataTable historyData = (DataTable)dgvHistoryTable.DataSource;

                        pdfDoc.Add(new Paragraph("History Table:", FontFactory.GetFont("Arial", 12, iTextSharp.text.Font.BOLD)));
                        pdfDoc.Add(new Paragraph(" "));

                        pdfDoc.Add(printTable(historyData));

                        pdfDoc.Close();
                        stream.Close();
                    }

                    MessageBox.Show("PDF report generated successfully!", "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error generating PDF: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        // FOR PRINTING TABLES IN PDF
        private PdfPTable printTable(DataTable table)
        {
            PdfPTable printTable = new PdfPTable(table.Columns.Count);

            // for each column of the table, these are the values and its design inside
            foreach (DataColumn column in table.Columns)
            {
                printTable.AddCell(new Phrase(column.ColumnName, FontFactory.GetFont("Arial", 10, iTextSharp.text.Font.BOLD)));
            }

            // for each cell in the row, print the value; if it's empty, then there's none displayed
            foreach (DataRow row in table.Rows)
            {
                foreach (var cell in row.ItemArray)
                    printTable.AddCell(cell?.ToString() ?? "");
            }

            return printTable;
        }
    }
}