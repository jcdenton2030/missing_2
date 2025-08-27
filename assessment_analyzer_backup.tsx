import React, { useState, useRef } from 'react';
import { Upload, User, BarChart3, FileText, X } from 'lucide-react';

const AssessmentAnalyzer = () => {
  const [assessmentData, setAssessmentData] = useState(null);
  const [lookupData, setLookupData] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentOptions, setStudentOptions] = useState([]);
  const [error, setError] = useState('');
  const assessmentFileRef = useRef(null);
  const lookupFileRef = useRef(null);

  // Parse CSV function using Papa Parse pattern
  const parseCSV = (content) => {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((header, index) => {
        let value = values[index] || '';
        // Try to convert to number if it looks like one
        if (value !== '' && value !== 'NA' && !isNaN(value) && value !== '1' && value !== '0') {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            row[header] = num;
          } else {
            row[header] = value;
          }
        } else if (value === '1') {
          row[header] = 1;
        } else {
          row[header] = value;
        }
      });
      data.push(row);
    }
    return { headers, data };
  };

  const handleFileUpload = async (file, type) => {
    try {
      const content = await file.text();
      const parsed = parseCSV(content);
      
      if (type === 'assessment') {
        setAssessmentData(parsed);
        // Create student options for dropdown
        const options = parsed.data.map(student => ({
          id: student['Unique ID'],
          name: student['Family name'],
          fullName: `${student['Given name'] || ''} ${student['Family name']}`.trim()
        }));
        setStudentOptions(options);
      } else {
        setLookupData(parsed);
      }
      setError('');
    } catch (err) {
      setError(`Error parsing ${type} file: ${err.message}`);
    }
  };

  const getPersonalInfo = (student) => {
    if (!student || !assessmentData) return [];
    
    const personalInfo = [];
    const headers = assessmentData.headers;
    
    // Find where question columns start (looking for column "1")
    const questionStartIndex = headers.findIndex(h => h === '1');
    
    // Get all columns before the questions
    const personalColumns = questionStartIndex > 0 ? headers.slice(0, questionStartIndex) : headers.slice(0, 10);
    
    personalColumns.forEach(column => {
      personalInfo.push({
        field: column,
        value: student[column] !== undefined ? student[column] : 'N/A'
      });
    });
    
    return personalInfo;
  };

  const calculateScalePerformance = (student) => {
    if (!student || !lookupData || !assessmentData) return [];

    // Find the strand row and correct answer row in lookup data
    const strandRow = lookupData.data.find(row => row['Question number'] === 'Strand');
    const correctAnswerRow = lookupData.data.find(row => row['Question number'] === 'Correct Answer');
    
    if (!strandRow || !correctAnswerRow) return [];

    const scalePerformance = {};
    
    // Get question numbers (columns 1-40)
    const questionColumns = assessmentData.headers.filter(h => /^\d+$/.test(h));
    
    questionColumns.forEach(questionNum => {
      const strand = strandRow[questionNum];
      const studentAnswer = student[questionNum];
      
      if (!strand) return;
      
      // Initialize scale if not exists
      if (!scalePerformance[strand]) {
        scalePerformance[strand] = {
          correct: 0,
          total: 0,
          attempted: 0
        };
      }
      
      scalePerformance[strand].total++;
      
      if (studentAnswer !== 'NA' && studentAnswer !== undefined) {
        scalePerformance[strand].attempted++;
        
        if (studentAnswer === 1) {
          scalePerformance[strand].correct++;
        }
      }
    });

    // Convert to array format with percentages
    return Object.entries(scalePerformance).map(([scale, performance]) => {
      const percentage = performance.attempted > 0 ? 
        ((performance.correct / performance.total) * 100).toFixed(1) : '0.0';
      
      return {
        scale,
        correct: performance.correct,
        total: performance.total,
        attempted: performance.attempted,
        percentage: parseFloat(percentage)
      };
    }).sort((a, b) => a.scale.localeCompare(b.scale));
  };

  const handleStudentSelect = (studentId) => {
    if (!studentId || !assessmentData) {
      setSelectedStudent(null);
      return;
    }

    const student = assessmentData.data.find(s => s['Unique ID'] == studentId);
    setSelectedStudent(student);
  };

  const personalInfo = selectedStudent ? getPersonalInfo(selectedStudent) : [];
  const scalePerformance = selectedStudent ? calculateScalePerformance(selectedStudent) : [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <BarChart3 className="text-blue-600" />
              Assessment Data Analyzer
            </h1>
            <p className="text-gray-600">Upload assessment results and lookup table to analyze student performance by scale</p>
          </div>

          {/* File Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-4" />
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assessment Results CSV
                </label>
                <input
                  ref={assessmentFileRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) handleFileUpload(file, 'assessment');
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {assessmentData && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ Loaded {assessmentData.data.length} students
                  </p>
                )}
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
              <div className="text-center">
                <FileText className="mx-auto h-8 w-8 text-gray-400 mb-4" />
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lookup Table CSV
                </label>
                <input
                  ref={lookupFileRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) handleFileUpload(file, 'lookup');
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {lookupData && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ Loaded lookup table with {lookupData.data.length} rows
                  </p>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Clear Data Button */}
          {(assessmentData || lookupData) && (
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => {
                  setAssessmentData(null);
                  setLookupData(null);
                  setSelectedStudent(null);
                  setStudentOptions([]);
                  setError('');
                  // Clear file inputs
                  if (assessmentFileRef.current) {
                    assessmentFileRef.current.value = '';
                  }
                  if (lookupFileRef.current) {
                    lookupFileRef.current.value = '';
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear All Data
              </button>
            </div>
          )}

          {/* Student Selection */}
          {assessmentData && lookupData && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <User className="text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Select Student</h3>
                <span className="text-sm text-gray-500">({studentOptions.length} available)</span>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {studentOptions.map((option, i) => (
                    <button
                      key={i}
                      onClick={() => handleStudentSelect(option.id.toString())}
                      className={`px-4 py-3 text-left rounded-md transition-colors ${
                        selectedStudent && selectedStudent['Unique ID'] === option.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-medium">{option.fullName}</div>
                      <div className="text-sm opacity-75">ID: {option.id}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Results Section */}
          {selectedStudent && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Personal Information Table */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                <div className="overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Field</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {personalInfo.map((info, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{info.field}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{info.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Scale Performance */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Scale</h3>
                <div className="space-y-4">
                  {scalePerformance.map((scale, i) => (
                    <div key={i} className="bg-white rounded-md p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium text-gray-900">Scale {scale.scale}</h4>
                        <span className="text-lg font-bold text-blue-600">{scale.percentage}%</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Correct: {scale.correct}/{scale.total}</span>
                        <span>Attempted: {scale.attempted}/{scale.total}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${scale.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!assessmentData || !lookupData ? (
            <div className="text-center py-12">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500">Upload both CSV files to begin analysis</p>
            </div>
          ) : !selectedStudent ? (
            <div className="text-center py-8">
              <User className="mx-auto h-8 w-8 text-gray-300 mb-4" />
              <p className="text-gray-500">Select a student to view their analysis</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AssessmentAnalyzer;
