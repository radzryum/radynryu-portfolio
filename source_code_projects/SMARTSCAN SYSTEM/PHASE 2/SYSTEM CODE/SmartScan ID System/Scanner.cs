using MySql.Data.MySqlClient;
using System;
using System.Drawing;
using System.IO;
using System.Media;
using System.Threading.Tasks;
using System.Windows.Forms;
using AForge.Video;
using AForge.Video.DirectShow;
using ZXing;
using ZXing.Common;
using System.Data;

// SCANNER PAGE
namespace SmartScan_ID_System_Project
{
    public partial class Scanner : Form
    {
        // global variables
        private string connectionString = "server=localhost;user=root;password=;database=SmartScanDB";
        private BarcodeReader barcodeReader = new BarcodeReader();
        private FilterInfoCollection filterInfoCollection;
        private VideoCaptureDevice videoCaptureDevice;
        private int tickCount = 0;

        public Scanner()
        {
            InitializeComponent();
            LoadAndSetScanMode();
            StartCamera();
            LoadTodaysScans();
            realTimeClock.Start();
        }

        // SETTINGS BUTTON
        private void btnSettings_Click(object sender, EventArgs e)
        {
            SettingsStudent settingsStudent = new SettingsStudent();
            settingsStudent.ShowDialog();
        }

        // VERIFY BUTTON (manual entry)
        private void btnVerifyStudent_Click(object sender, EventArgs e)
        {
            string studentNo = tbStudentNum.Text.Trim();

            if (string.IsNullOrEmpty(studentNo))
            {
                MessageBox.Show("Please scan or enter a student ID first.", "Scan Required");
                return;
            }

            ProcessScan(studentNo);
            ResetForNextScanAsync();
        }

        // OPEN CAMERA
        private void StartCamera()
        {
            filterInfoCollection = new FilterInfoCollection(FilterCategory.VideoInputDevice);

            if (filterInfoCollection.Count == 0)
            {
                MessageBox.Show("No camera found. Please connect a webcam.", "Error",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            videoCaptureDevice = new VideoCaptureDevice(filterInfoCollection[0].MonikerString);
            videoCaptureDevice.NewFrame += VideoCaptureDevice_NewFrame;
            videoCaptureDevice.Start();
            timerScan.Start();
        }

        // CAMERA FRAME EVENT
        private void VideoCaptureDevice_NewFrame(object sender, NewFrameEventArgs eventArgs)
        {
            pbCamera.Image = (Bitmap)eventArgs.Frame.Clone();
        }

        // LOAD SCAN MODE
        private void LoadAndSetScanMode()
        {
            string mode = "BOTH";

            using (MySqlConnection conn = new MySqlConnection(connectionString))
            {
                conn.Open();
                string selectQuery = "SELECT scanner_mode FROM Scanner_Configuration WHERE configuration_id = 1";

                using (MySqlCommand cmd = new MySqlCommand(selectQuery, conn))
                {
                    object result = cmd.ExecuteScalar();
                    if (result != null)
                    {
                        mode = result.ToString().ToUpperInvariant();
                    }
                }

                // configure scanner based on mode
                DecodingOptions options = new DecodingOptions();

                switch (mode)
                {
                    case "QR":
                        options.PossibleFormats = new System.Collections.Generic.List<BarcodeFormat>
                            { BarcodeFormat.QR_CODE };
                        break;
                    case "BARCODE":
                        options.PossibleFormats = new System.Collections.Generic.List<BarcodeFormat>
                            { BarcodeFormat.CODE_128, BarcodeFormat.CODE_39 };
                        break;
                    case "BOTH":
                    default:
                        options.PossibleFormats = new System.Collections.Generic.List<BarcodeFormat>
                            { BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39 };
                        break;
                }

                barcodeReader.Options = options;
                Console.WriteLine($"Scanner initialized in: {mode} mode.");
            }
        }

        // LOAD TODAY'S SCANS
        private void LoadTodaysScans()
        {
            using (MySqlConnection conn = new MySqlConnection(connectionString))
            {
                try
                {
                    string query = @"
                        SELECT sr.reference_number, s.student_name, sr.student_id, sr.scan_datetime
                        FROM Scan_Records sr
                        JOIN Students s ON sr.student_id = s.student_id
                        WHERE DATE(sr.scan_datetime) = CURDATE()
                        ORDER BY sr.scan_datetime DESC;";

                    MySqlDataAdapter da = new MySqlDataAdapter(query, conn);
                    DataTable dt = new DataTable();
                    da.Fill(dt);

                    dgvScanHistory.DataSource = dt;
                }
                catch (MySqlException ex)
                {
                    MessageBox.Show($"Failed to load today's scan history: {ex.Message}",
                        "Database Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }

        // PROCESS SCAN
        private void ProcessScan(string studentNo)
        {
            using (MySqlConnection conn = new MySqlConnection(connectionString))
            {
                try
                {
                    conn.Open();

                    // checks if student exists
                    string studentName = "";
                    string studentId = "";
                    string studentProgram = "";

                    string query = "SELECT student_name, student_id, course FROM Students WHERE student_id = @studentId";
                    using (MySqlCommand selectCmd = new MySqlCommand(query, conn))
                    {
                        selectCmd.Parameters.AddWithValue("@studentId", studentNo);
                        using (MySqlDataReader reader = selectCmd.ExecuteReader())
                        {
                            if (!reader.Read())
                            {
                                SystemSounds.Hand.Play();
                                MessageBox.Show($"Student ID '{studentNo}' not found.", "Verification Failed",
                                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                                return;
                            }

                            studentName = reader["student_name"].ToString();
                            studentId = reader["student_id"].ToString();
                            studentProgram = reader["course"].ToString();
                        }
                    }

                    // check for current date's duplicate scan
                    string checkScanQuery = "SELECT COUNT(*) FROM Scan_Records WHERE student_id = @studentId AND DATE(scan_datetime) = CURDATE()";
                    using (MySqlCommand checkCmd = new MySqlCommand(checkScanQuery, conn))
                    {
                        checkCmd.Parameters.AddWithValue("@studentId", studentNo);
                        long scanCount = (long)checkCmd.ExecuteScalar();

                        if (scanCount >= 1)
                        {
                            SystemSounds.Hand.Play();
                            MessageBox.Show($"Student '{studentName}' ({studentNo}) has already been scanned today.",
                                "Duplicate Scan", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                            return;
                        }
                    }

                    // insert new scan record
                    string refNo = "VR-" + DateTime.Now.ToString("yyyyMMddHHmmssfff");
                    string insertQuery = "INSERT INTO Scan_Records (reference_number, student_id, scan_datetime) VALUES (@refNo, @studentId, NOW())";

                    using (MySqlCommand insertCmd = new MySqlCommand(insertQuery, conn))
                    {
                        insertCmd.Parameters.AddWithValue("@refNo", refNo);
                        insertCmd.Parameters.AddWithValue("@studentId", studentNo);
                        insertCmd.ExecuteNonQuery();
                    }

                    // load profile picture
                    string folderPath = Path.Combine(Application.StartupPath, "Resources", "profiles");
                    string filePath = Path.Combine(folderPath, studentId + ".jpg");

                    if (File.Exists(filePath))
                    {
                        pbStudentPfp.Image = Image.FromFile(filePath);
                    }
                    else
                    {
                        pbStudentPfp.Image = null;
                    }

                    // display verification panel
                    panelStudentVerification.Visible = true;
                    lblStudentName.Text = studentName;
                    lblStudentIdNumber.Text = studentId;
                    lblProgram.Text = studentProgram;
                    lblTimeIn.Text = "Time in: " + DateTime.Now.ToString("ddd MMM dd, yyyy hh:mm:ss tt");

                    tickCount = 0;
                    delayCounter.Start();

                    LoadTodaysScans();
                }
                catch (MySqlException ex)
                {
                    MessageBox.Show($"Database connection error: {ex.Message}", "Error",
                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }

        // TIMER FOR SCANNING
        private void timerScan_Tick(object sender, EventArgs e)
        {
            if (pbCamera.Image == null) return;

            try
            {
                Result result = barcodeReader.Decode((Bitmap)pbCamera.Image);

                if (result != null)
                {
                    timerScan.Stop();
                    this.Invoke((MethodInvoker)delegate
                    {
                        string scannedId = result.Text;
                        tbStudentNum.Text = scannedId;
                        SystemSounds.Beep.Play();
                        ProcessScan(scannedId);
                        ResetForNextScanAsync();
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Scan error: {ex.Message}");
            }
        }

        // VERIFICATION PANEL TIMER (for it to disapppear)
        private void delayCounter_Tick(object sender, EventArgs e)
        {
            tickCount++;

            if (tickCount >= 40) // 40 ticks = 8 seconds (assuming 200ms interval)
            {
                panelStudentVerification.Visible = false;
                delayCounter.Stop();
                tickCount = 0;
            }
        }

        // CLOCK TIMER (for data)
        private void realTimeClock_Tick(object sender, EventArgs e)
        {
            DateTime currentDate = DateTime.Now;
            lblCurrDate.Text = currentDate.ToString("MMMM dd, yyyy");
            lblCurrTime.Text = currentDate.ToString("hh:mm:ss tt");
        }

        // RESET FOR NEXT SCAN
        private async Task ResetForNextScanAsync()
        {
            await Task.Delay(1500); // prevent immediate re-scan
            tbStudentNum.Clear();
            tbStudentNum.Focus();
            timerScan.Start();
        }

        // FORM CLOSING EVENT
        private void Scanner_FormClosing(object sender, FormClosingEventArgs e)
        {
            // CLEAN UP CAMERA RESOURCES
            timerScan.Stop();

            if (videoCaptureDevice != null && videoCaptureDevice.IsRunning)
            {
                videoCaptureDevice.SignalToStop();
                videoCaptureDevice.WaitForStop();
                videoCaptureDevice.NewFrame -= VideoCaptureDevice_NewFrame;
                videoCaptureDevice = null;
            }
        }
    }
}