using AForge.Video; // for camera capture
using AForge.Video.DirectShow;
using System;
using System.Drawing;
using System.Windows.Forms;

// VIEW DATA PAGE
namespace SmartScan_ID_System_Project
{
    public partial class ViewDataPage : Form
    {
        // global variables for the camera system
        FilterInfoCollection filterInfoCollection;
        VideoCaptureDevice captureDevice;
        public ViewDataPage()
        {
            InitializeComponent();
            InitializeDataGridView();

            filterInfoCollection = new FilterInfoCollection(FilterCategory.VideoInputDevice);
            captureDevice = new VideoCaptureDevice(filterInfoCollection[0].MonikerString);
            captureDevice.NewFrame += CaptureDevice_NewFrame;
            captureDevice.Start();

        }

        // SETTINGS
        private void btnSettings_Click(object sender, EventArgs e)
        {
            SettingsStudent settingsStudent = new SettingsStudent();
            settingsStudent.Show();

            this.Close();
        }

        // CAMERA FRAME EVENT
        private void CaptureDevice_NewFrame(object sender, NewFrameEventArgs eventArgs)
        {
            Bitmap image = (Bitmap)eventArgs.Frame.Clone();
            pbCamera.Image = image;
        }

        // DATAGRID VIEW INITIALIZATION
        private void InitializeDataGridView()
        {
            dgvScanHistory.Columns.Add("No", "No.");
            dgvScanHistory.Columns.Add("Name", "Name");
            dgvScanHistory.Columns.Add("IDNo", "ID No.");
            dgvScanHistory.Columns.Add("Time", "Time");

            dgvScanHistory.Columns["No"].Width = 50;
            dgvScanHistory.Columns["Name"].AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill;
            dgvScanHistory.Columns["IDNo"].Width = 100;
            dgvScanHistory.Columns["Time"].Width = 100;

            AddSampleData();
        }

        // DATA FOR TESTING PURPOSES
        private void AddSampleData()
        {
            for (int i = 1; i <= 20; i++)
            {
                dgvScanHistory.Rows.Add(i, $"Student {i}", $"ID{i:0000}", DateTime.Now.ToString("HH:mm:ss"));
            }
        }

        // CLOSE FORM EVENT
        private void ViewData_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (captureDevice.IsRunning)
            {
                captureDevice.Stop();
            }
        }
    }
}