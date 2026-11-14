$(document).ready(function() {
    let selectedTable = null;
    let currentUser = null;

    // Initialize the page
    initPage();

    // Initialize page elements and event listeners
    function initPage() {
        // Clear any existing modal backdrops
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();
        
        checkLoginStatus();
        setupEventListeners();
        setDefaultReservationDate();
    }
    // Set up event listeners
// Set up event listeners
function setupEventListeners() {
    // Remove any existing click handlers to prevent duplicates
    $(' #bookTableBtn').off('click');
    
    // Handle Book Table button click
    $('#bookTableBtn').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Hide reservation modal if it's showing
        $('#reservationModal').modal('hide');
        
        // Show notice modal first
        $('#noticeModal').modal('show');
    });

    // Handle "I Understand" button click
    $('#proceedToReservationBtn').off('click').on('click', function() {
        $('#noticeModal').modal('hide');
        
        // Only show reservation modal after notice modal is fully hidden
        $('#noticeModal').on('hidden.bs.modal', function() {
            $('#reservationModal').modal('show');
            // Remove the event listener to prevent multiple bindings
            $('#noticeModal').off('hidden.bs.modal');
        });
    });
    
    // Rest of your existing event listeners...
    $('#reservationForm').on('submit', handleReservationSubmit);
    $('#loginForm').on('submit', handleLoginSubmit);
    $('#registerForm').on('submit', handleRegisterSubmit);
    
    // Date/Time change handlers
    $('#reservationDate, #reservationTime').on('change', loadAvailableTables);
    
    // Modal shown events
    $('#reservationsModal').on('show.bs.modal', loadReservations);
    
    $('#reservationModal').on('shown.bs.modal', function() {
        const date = $('#reservationDate').val();
        const time = $('#reservationTime').val();
        if (date && time) loadAvailableTables();
        
        // Reset form state
        $('#reservationForm')[0].reset();
        $('.table-card').removeClass('selected bg-primary text-white');
        selectedTable = null;
        setDefaultReservationDate();
    });
    
    // Clear selection when reservation modal hides
    $('#reservationModal').on('hidden.bs.modal', function() {
        $('.table-card').removeClass('selected bg-primary text-white');
        selectedTable = null;
    });
    
    // Initialize logout functionality
    $(document).on('click', '#logoutBtn', function(e) {
        e.preventDefault();
        logout();
    });
    
    // Check initial login status
    checkLoginStatus();
}
// Add this to your setupEventListeners function
$('#bookTableBtn').on('click', function() {
    $('#noticeModal').modal('show');
});

    // Set default reservation date to today
    function setDefaultReservationDate() {
        const today = new Date().toISOString().split('T')[0];
        $('#reservationDate').val(today);
    }

    // Handle reservation form submission
    function handleReservationSubmit(e) {
        e.preventDefault();
        
        if (!selectedTable) {
            showAlert('Please select a table', 'warning');
            return;
        }
    
        const reservationData = {
            date: $('#reservationDate').val(),
            time: $('#reservationTime').val(),
            table: selectedTable.number,
            requests: $('#specialRequests').val(),
            created_at: new Date().toISOString(),
            status: 'pending',
            name: $('#reservationName').val(),
            phone: $('#reservationPhone').val(),
            email: $('#reservationEmail').val(),
            occasion: $('#reservationOccasion').val()
        };
    
        // Validate required fields
        if (!reservationData.date || !reservationData.time || 
            !reservationData.name || !reservationData.phone || !reservationData.email) {
            showAlert('Please fill all required fields', 'warning');
            return;
        }
    
        const $submitBtn = $(this).find('[type="submit"]');
        $submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Processing...');
    
        $.ajax({
            url: 'php/reserve.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(reservationData),
            dataType: 'json'
        })
        .done(function(response) {
            if (response && response.success) {
                showReservationSuccess(
                    selectedTable.number,
                    reservationData.date,
                    reservationData.time,
                    'pending'
                );
                $('#reservationModal').modal('hide');
                addNewReservation({
                    table: selectedTable.number,
                    date: reservationData.date,
                    time: reservationData.time,
                    status: 'pending'
                });
            } else {
                const errorMsg = response?.message || 'Reservation failed';
                showAlert(errorMsg, 'danger');
            }
        })
        .fail(function(xhr) {
            let errorMsg = 'Error processing reservation';
            
            try {
                const response = xhr.responseJSON;
                if (response && response.message) {
                    errorMsg = response.message;
                } else if (xhr.statusText) {
                    errorMsg += `: ${xhr.statusText}`;
                }
            } catch (e) {
                console.error('Error parsing error response:', e);
            }
            
            console.error("Reservation error:", xhr.responseText);
            showAlert(errorMsg, 'danger');
        })
        .always(function() {
            $submitBtn.prop('disabled', false).text('Book Table');
        });
    }

    // Handle login form submission
    function handleLoginSubmit(e) {
        e.preventDefault();
        
        const $form = $(this);
        const $submitBtn = $form.find('[type="submit"]');
        const originalBtnText = $submitBtn.html();
        
        $submitBtn.prop('disabled', true).html(
            '<span class="spinner-border spinner-border-sm"></span> Logging in...'
        );
        
        const formData = {
            login: $('#loginInput').val().trim(),
            password: $('#loginPassword').val().trim()
        };
        
        $.ajax({
            url: 'php/login.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            dataType: 'json'
        })
        .done(function(response) {
            if (response && response.success) {
                localStorage.setItem('kpopCafeUser', JSON.stringify(response.user));
                updateNavForLoggedInUser();
                $('#loginModal').modal('hide');
                $('#welcomeMessage').text(`Welcome back, ${response.user.username}!`);
                showLoginSuccessModal();
                loadReservations();
            } else {
                showAlert(response.message || "Login failed. Please try again.", 'danger');
            }
        })
        .fail(function(xhr) {
            console.error("Login error:", xhr.responseText);
            showAlert("Login failed. Please try again.", 'danger');
        })
        .always(function() {
            $submitBtn.prop('disabled', false).html(originalBtnText);
        });
    }

    // Handle registration form submission
    function handleRegisterSubmit(e) {
        e.preventDefault();
        
        const $submitBtn = $(this).find('[type="submit"]');
        const originalBtnText = $submitBtn.text();
        $submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Creating account...');
    
        if ($('#registerPassword').val() !== $('#registerConfirmPassword').val()) {
            showAlert('Passwords do not match', 'warning');
            $submitBtn.prop('disabled', false).text(originalBtnText);
            return;
        }
    
        const formData = {
            username: $('#registerUsername').val().trim(),
            email: $('#registerEmail').val().trim(),
            password: $('#registerPassword').val().trim()
        };
    
        $.ajax({
            url: 'php/register.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            dataType: 'json',
            success: function(response) {
                if (response && response.success) {
                    $('#registerForm')[0].reset();
                    $('#registerModal').modal('hide');
                    // Set the success message with username
                    const username = response.user.username; // Make sure your API returns this
                    $('#registerSuccessMessage').text(`Your account has been created, ${username}!`);
                    $('#registerSuccessModal').modal('show');
                    showAlert('Registration successful! Please login.', 'success');
                    
                } else {
                    showAlert(response.message || 'Registration failed. Please try again.', 'danger');
                }
            },
            error: function(xhr) {
                console.error("Registration error:", xhr.responseText);
                showAlert('Registration failed. Please try again.', 'danger');
            },
            complete: function() {
                $submitBtn.prop('disabled', false).text(originalBtnText);
            }
        });
    }

    // Load available tables based on selected date/time
    function loadAvailableTables() {
        console.log('Loading tables...'); // Debug
        const date = $('#reservationDate').val();
        const time = $('#reservationTime').val();
        
        if (!date || !time) {
            console.log('Date or time not selected'); // Debug
            return;
        }
        
        $('#tablesContainer').html('<div class="text-center py-4"><div class="spinner-border text-primary"></div> Loading tables...</div>');
        
        $.ajax({
            url: 'php/get_tables.php',
            method: 'GET',
            data: { date: date, time: time },
            dataType: 'json',
            success: function(response) {
                if (response.success && response.tables) {
                    displayTables(response.tables);
                } else {
                    $('#tablesContainer').html(`
                        <div class="alert alert-danger">
                            ${response.message || 'Error loading tables'}
                        </div>
                    `);
                }
            },
            error: function(xhr) {
                console.error("Error loading tables:", xhr.responseText);
                $('#tablesContainer').html(`
                    <div class="alert alert-danger">
                        Error loading available tables
                    </div>
                `);
            }
        });
    }

    // Display available tables
// Update the displayTables function to properly bind click events
function displayTables(tables) {
    $('#tablesContainer').empty();
    
    tables.forEach(table => {
        const isAvailable = !table.is_reserved;
        const tableCard = $(`
            <div class="col-md-3 mb-3">
                <div class="card table-card ${isAvailable ? '' : 'reserved'}" 
                     data-id="${table.id}"
                     data-table-number="${table.table_number}"
                     data-capacity="${table.capacity}"
                     data-location="${table.location}">
                    <div class="card-body text-center">
                        <h5 class="card-title">Table ${table.table_number}</h5>
                        <p class="card-text">
                            <small>Capacity: ${table.capacity}<br>
                            ${table.location}</small>
                        </p>
                        <span class="badge" style="background-color: ${isAvailable ? '#e53888' : '#AC1754'}; color: white;">
                            ${isAvailable ? 'Available' : 'Reserved'}
                        </span>
                    </div>
                </div>
            </div>
        `);
        
        if (isAvailable) {
            tableCard.find('.card').on('click', function() {
                selectTable(this);
            });
        }
        
        $('#tablesContainer').append(tableCard);
    });
}

// Update the selectTable function
function selectTable(element) {
    // First deselect any currently selected table
    $('.table-card').removeClass('selected bg-primary text-white');
    
    // Select the clicked table
    $(element).addClass('selected bg-primary text-white');
    
    // Update the selectedTable variable
    selectedTable = {
        number: $(element).data('table-number'),
        id: $(element).data('id'),
        capacity: $(element).data('capacity'),
        location: $(element).data('location')
    };
    
    console.log('Table selected:', selectedTable); // For debugging
    
    // Enable the submit button
    $('#reservationForm button[type="submit"]').prop('disabled', false);
}

    // Handle table selection
// Update the selectTable function in script.js
    function selectTable(element) {
        $('.table-card').removeClass('selected bg-primary text-white');
        $(element).addClass('selected bg-primary text-white');
        
        selectedTable = {
            number: $(element).data('table-number'),
            id: $(element).data('id'),
            capacity: $(element).data('capacity'),
            location: $(element).data('location')
        };
        
        // Enable the submit button
        $('#reservationForm button[type="submit"]').prop('disabled', false);
    }

    // Load and display user reservations
    function loadReservations() {
        const user = JSON.parse(localStorage.getItem('kpopCafeUser'));
        if (!user) {
            $('#reservationStatusList').html(`
                <div class="alert alert-warning">
                    Please login to view your reservations
                </div>
            `);
            return;
        }

        $('#loadingReservations').show();
        $('#reservationStatusList').html('<div id="loadingReservations" class="text-center py-4"><div class="spinner-border text-primary"></div><p>Loading your reservations...</p></div>');

        $.ajax({
            url: 'php/get_user_reservations.php',
            method: 'GET',
            dataType: 'json',
            success: function(response) {
                $('#loadingReservations').hide();
                if (response.success) {
                    updateReservationList(response.reservations);
                    updateReservationBadge(response.reservations.length);
                } else {
                    $('#reservationStatusList').html(`
                        <div class="alert alert-info">
                            You don't have any reservations yet
                        </div>
                    `);
                    updateReservationBadge(0);
                }
            },
            error: function(xhr) {
                $('#loadingReservations').hide();
                $('#reservationStatusList').html(`
                    <div class="alert alert-danger">
                        Error loading reservations: ${xhr.responseText || 'Please try again later'}
                    </div>
                `);
                console.error("Error loading reservations:", xhr.responseText);
            }
        });
    }

    // Update reservation list display
    function updateReservationList(reservations) {
        const statusList = $('#reservationStatusList');
        statusList.empty();

        if (reservations.length === 0) {
            statusList.append('<div class="alert alert-info">No reservations found</div>');
            return;
        }

        reservations.forEach(reservation => {
            const statusClass = {
                'pending': 'text-bg-warning',
                'confirmed': 'text-bg-success',
                'cancelled': 'text-bg-danger'
            }[reservation.status] || 'text-bg-secondary';
            
            const formattedDate = new Date(reservation.reservation_date).toLocaleDateString();
            const formattedTime = formatTime(reservation.reservation_time);
            
            const listItem = $(`
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">Table ${reservation.table_number}</h6>
                            <small>${formattedDate} at ${formattedTime}</small>
                        </div>
                        <span class="badge ${statusClass} rounded-pill">${reservation.status}</span>
                    </div>
                    ${reservation.special_requests ? `<p class="mt-2 mb-1"><small>Notes: ${reservation.special_requests}</small></p>` : ''}
                </div>
            `);
            
            statusList.append(listItem);
        });
    }

    // Add a new reservation to the list
    function addNewReservation(reservation) {
        loadReservations(); // Refresh the list
        const currentCount = parseInt($('#reservationBadge').text()) || 0;
        updateReservationBadge(currentCount + 1);
    }

    // Update reservation badge count
    function updateReservationBadge(count) {
        const $badge = $('#reservationBadge');
        if (count > 0) {
            $badge.text(count).show();
        } else {
            $badge.hide();
        }
    }

    // Show reservation success message
    function showReservationSuccess(tableNumber, date, time, status) {
        const formattedDate = new Date(date).toLocaleDateString();
        const formattedTime = formatTime(time);
        
        $('#successModalBody').html(`
            <div class="text-center">
                <i class="fas fa-check-circle fa-5x mb-3" style="color: #e53888;"></i>
                <h4>Reservation ${status === 'confirmed' ? 'Confirmed' : 'Received'}!</h4>
                <p>Table ${tableNumber} on ${formattedDate} at ${formattedTime}</p>
                <p class="badge" style="background-color: ${status === 'confirmed' ? '#AC1754' : '#f37199'}; color: white;">
                    Status: ${status}
                </p>
                <div class="d-grid gap-2 mt-3">
                    <button class="btn" style="background-color: #AC1754; color: white;" data-bs-dismiss="modal">Done</button>
                    <button class="btn btn-outline-secondary" style="border-color: #AC1754; color: #AC1754;" data-bs-dismiss="modal" data-bs-toggle="modal" data-bs-target="#reservationsModal">
                        View All Reservations
                    </button>
                </div>
            </div>
        `);
        
        $('#successModal').modal('show');
    }

    // Show login success modal
    function showLoginSuccessModal() {
        const modal = new bootstrap.Modal(document.getElementById('loginSuccessModal'));
        modal.show();
    }

    // Check login status
    function checkLoginStatus() {
        const user = JSON.parse(localStorage.getItem('kpopCafeUser'));
        if (user) {
            currentUser = user;
            updateNavForLoggedInUser();
            loadReservations();
        }
    }

    // Update navigation for logged in user
    function updateNavForLoggedInUser() {
        const user = JSON.parse(localStorage.getItem('kpopCafeUser'));
        const $authNav = $('#authNav');
        
        $authNav.empty();
        
        if (user) {
            $authNav.append(`
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="fas fa-user me-1"></i> ${user.username}
                    </a>
                    <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
                        <li><a class="dropdown-item" href="#"><i class="fas fa-user me-1"></i> Profile</a></li>
                        <li><a class="dropdown-item" href="#" data-bs-toggle="modal" data-bs-target="#reservationsModal"><i class="fas fa-calendar-alt me-1"></i> Reservations</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#" id="logoutBtn"><i class="fas fa-sign-out-alt me-1"></i> Logout</a></li>
                    </ul>
                </li>
            `);
            
            $('#logoutBtn').on('click', function(e) {
                e.preventDefault();
                logout();
            });
        } else {
            $authNav.append(`
                <li class="nav-item">
                    <button class="btn btn-outline-light me-2" data-bs-toggle="modal" data-bs-target="#loginModal">Login</button>
                </li>
                <li class="nav-item">
                    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#registerModal">Sign Up</button>
                </li>
            `);
        }
    }

    // Handle logout
    function logout() {
        currentUser = null;
        localStorage.removeItem('kpopCafeUser');
        
        $.ajax({
            url: 'php/logout.php',
            method: 'POST',
            success: function() {
                // Show logout success modal
                const logoutModal = new bootstrap.Modal(document.getElementById('logoutSuccessModal'));
                logoutModal.show();
                
                // Update navigation immediately
                updateNavForLoggedInUser();
                
                // Close modal and refresh after 2 seconds
                $('#logoutSuccessModal').on('hidden.bs.modal', function() {
                    location.reload();
                });
            },
            error: function() {
                // Still update UI even if logout request fails
                updateNavForLoggedInUser();
                location.reload();
            }
        });
    }

    // Show alert message
    function showAlert(message, type = 'info') {
        const alertClass = {
            'info': 'alert-info',
            'success': 'alert-success',
            'warning': 'alert-warning',
            'danger': 'alert-danger'
        }[type] || 'alert-info';

        const $notification = $(`
            <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `);

        $('#alertsContainer').append($notification);
        setTimeout(() => $notification.alert('close'), 5000);
    }

    // Helper function to format time
    function formatTime(timeString) {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        return hour > 12 ? `${hour-12}:${minutes} PM` : `${hour}:${minutes} AM`;
    }
});
