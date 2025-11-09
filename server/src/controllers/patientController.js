const Study = require('../models/Study');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Counter = require('../models/Counter');

const mongoose = require("mongoose");

async function getPatients(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    console.log("🔍 Requested user:", req.user);
    console.log("🏥 Hospital ID from token:", req.user.hospitalId);

    const query = {};

    const isSuperAdmin = req.user.roles?.includes("system:admin") || req.user.roles?.includes("super_admin");

if (!isSuperAdmin && req.user.hospitalId) {

  const hospitalUser = await User.findById(req.user.hospitalId).lean();

  if (!hospitalUser) {
    return res.status(404).json({ success: false, message: "Hospital user not found" });
  }

 const isAdminUser = req.user.roles?.includes("admin");

  const finalHospitalId = isAdminUser
    ? hospitalUser._id
    : (hospitalUser.hospitalId ? hospitalUser.hospitalId : hospitalUser._id);
  // ✅ VALIDATION ADDED
  if (!mongoose.isValidObjectId(finalHospitalId)) {
    console.log("⚠ Invalid ObjectId:", finalHospitalId);
    return res.status(400).json({ success: false, message: "Invalid hospital ID format" });
  }

  query.hospitalId = new mongoose.Types.ObjectId(finalHospitalId);

  console.log(`🏥 User found: ${hospitalUser._id}`);
  console.log(`✅ Using hospitalId for filter: ${finalHospitalId}`);
}




    const patients = await Patient.find(query).lean();
    console.log(`📋 Found ${patients.length} patients`);

    const out = patients.map(p => ({
      patientID: p.patientID,
      patientName: p.patientName || "Unknown",
      birthDate: p.birthDate || "",
      sex: p.sex || "",
      studyCount: Array.isArray(p.studyIds) ? p.studyIds.length : 0,
      hospitalId: p.hospitalId?.toString() || null
    }));

    return res.json({ success: true, data: out });

  } catch (e) {
    console.error("❌ Failed to list patients:", e);
    return res.status(500).json({ success: false, message: e.message });
  }
}




async function getPatientStudies(req, res) {
  try {
    const { patientID } = req.params;

    // Step 1️⃣: Find patient by patientID
    const patient = await Patient.findOne({ patientID }).lean();
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Step 2️⃣: Fetch studies based on patientID
    let studies = [];
    if (Array.isArray(patient.studyIds) && patient.studyIds.length > 0) {
      studies = await Study.find({ studyInstanceUID: { $in: patient.studyIds } }).lean();
    } else {
      // Fallback: fetch all studies with the same patientID
      studies = await Study.find({ patientID }).lean();
    }

    // Step 3️⃣: Format output
    const out = studies.map(s => ({
      studyInstanceUID: s.studyInstanceUID,
      patientName: s.patientName || patient.patientName || 'Unknown',
      patientID: s.patientID || patientID,
      modality: s.modality || 'OT',
      numberOfSeries: s.numberOfSeries || 1,
      numberOfInstances: s.numberOfInstances || 1,
      studyDescription: s.studyDescription || ''
    }));

    res.json({ success: true, data: out });

  } catch (e) {
    console.error('❌ Failed to list patient studies:', e);
    res.status(500).json({ success: false, message: e.message });
  }
}


async function createPatient(req, res) {
  try {
    const { patientID: providedPatientID, patientName, birthDate, sex } = req.body || {}

    // Check authentication
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' })
    }

    // Get hospitalId from authenticated user (already a string from JWT)
    const hospitalId = req.user.hospitalId || null;

    // Determine patientID: use provided if present; otherwise generate sequential ID
    let patientID = (typeof providedPatientID === 'string' && providedPatientID.trim()) ? providedPatientID.trim() : null;

    if (!patientID) {
      // Atomically increment patient counter and generate ID with pt- prefix
      const counter = await Counter.findOneAndUpdate(
        { name: 'patient' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const seqNum = counter.seq || 1;
      const padded = String(seqNum).padStart(4, '0');
      patientID = `PT-${padded}`;
      console.log(`🆔 Generated patientID: ${patientID}`);
    }

    console.log(`👤 Creating patient ${patientID} for hospital: ${hospitalId} by user: ${req.user.username}`);

    // Upsert patient by patientID
    const existing = await Patient.findOne({ patientID })
    if (existing) {
      existing.patientName = patientName ?? existing.patientName
      existing.birthDate = birthDate ?? existing.birthDate
      existing.sex = sex ?? existing.sex
      // Update hospitalId if not set
      if (!existing.hospitalId && hospitalId) {
        existing.hospitalId = hospitalId;
        console.log(`   ✅ Updated existing patient with hospitalId: ${hospitalId}`);
      }
      await existing.save()
      return res.json({
        success: true,
        data: {
          patientID: existing.patientID,
          hospitalId: existing.hospitalId ? existing.hospitalId.toString() : null
        }
      })
    }

    const patient = new Patient({
      patientID,
      patientName,
      birthDate,
      sex,
      studyIds: [],
      hospitalId
    })
    await patient.save()
    console.log(`   ✅ Created new patient with hospitalId: ${hospitalId}`);

    res.json({
      success: true,
      data: {
        patientID: patient.patientID,
        hospitalId: patient.hospitalId ? patient.hospitalId.toString() : null
      }
    })
  } catch (e) {
    console.error('Failed to create patient:', e)
    res.status(500).json({ success: false, message: e.message })
  }
}

module.exports = { getPatients, getPatientStudies, createPatient }