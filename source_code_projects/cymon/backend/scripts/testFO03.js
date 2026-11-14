const fs = require('fs');
const path = require('path');
const { renderFormPdf } = require('../lib/formPdf'); // Wait, renderFormPdf is not exported? Let's check

async function run() {
    try {
        // Mock data - bundle matches loadStaffPdfRecord structure
        const bundle = {
            patient: {
                first_name: 'Juan', last_name: 'Dela Cruz',
                full_name: 'Juan Dela Cruz',
                age: 8, sex: 'M', date_of_birth: '2018-03-15',
                treating_psychometrician: { display_name: 'Cassandra Nicole Sante', license_no: '12345678', title: 'RPm' },
                treating_psychologist: { display_name: 'Dr. Ana Reyes', license_no: '87654321', title: 'RPsy' },
            },
            clinical: { working_diagnosis: 'Autism Spectrum Disorder', medical_history: 'No significant history.', family_history: 'Father has ADHD.' },
            guardians: [],
            emergency: {},
        };

        // Answers in nested format (exactly what frontend buildAnswersPayload produces)
        const submission = {
            content: JSON.stringify({ evaluatorName: 'Cassandra Nicole Sante' }),
            metadata: JSON.stringify({ diagnosis: 'ASD Level 1', medical_history: 'No significant history.', family_history: 'Father has ADHD.', respondent_relationship: 'Grandparent' }),
            answers: JSON.stringify({
                conceptual_1: { response: 'yes', remarks: '' },
                conceptual_2: { response: 'no', remarks: '' },
                conceptual_3: { response: 'yes', remarks: '' },
                conceptual_4: { response: 'yes', remarks: '' },
                conceptual_5: { response: 'no', remarks: '' },
                social_1: { response: 'no', remarks: '' },
                social_2: { response: 'no', remarks: '' },
                social_3: { response: 'yes', remarks: '' },
                perceptual_1: { response: 'no', remarks: 'Sample sample Sample sample S' },
                perceptual_2: { response: 'no', remarks: 'Sample sample Sample sample S' },
                stimming_1: { response: 'yes', remarks: 'Sample sample Sample sample S' },
                stimming_2: { response: 'yes', remarks: 'Sample sample Sample sample S' },
                stimming_3: { response: 'no', remarks: 'Sample sample Sample sample S' },
            }),
            submitted_at: null,   // draft — no submitted_at yet
            created_at: new Date('2026-08-25').toISOString(),  // should appear as date of assessment
            respondent_relationship: 'Grandparent',  // Others case
            respondent_profile: { display_name: 'Cassandra Nicole Sante', license_no: '12345678', title: 'RPm' },
            reviewer_profile: { display_name: 'Dr. Ana Reyes', license_no: '87654321', title: 'RPsy' },
        };

        const requestingUser = { display_name: 'Admin User', email: 'admin@example.com' };

        const pdfBytes = await renderFormPdf({
            code: 'CMPS:SE-FO-03',
            bundle,
            submission,
            report: null,
            requestingUser,
            isCtc: false
        });

        fs.writeFileSync(path.join(__dirname, 'test_fo03.pdf'), pdfBytes);
        console.log('Successfully wrote test_fo03.pdf');
    } catch(e) {
        console.error(e);
    }
}

run();
