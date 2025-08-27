import React, { useState, useRef } from 'react';
import { Upload, User, BarChart3, FileText, X, ChevronUp, ChevronDown } from 'lucide-react';

const AssessmentAnalyzer = () => {
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [lookupData, setLookupData] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentOptions, setStudentOptions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [sortConfig, setSortConfig] = useState<any>({}); // Track sorting for each scale
  const [dragOver, setDragOver] = useState({ assessment: false, lookup: false });
  const assessmentFileRef = useRef<HTMLInputElement>(null);
  const lookupFileRef = useRef<HTMLInputElement>(null);

  // Parse CSV function using Papa Parse pattern
  const parseCSV = (content: string) => {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header: string, index: number) => {
        let value = values[index] || '';
        // Try to convert to number if it looks like one
        if (value !== '' && value !== 'NA' && !isNaN(Number(value)) && value !== '1' && value !== '0') {
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

  const handleFileUpload = async (file: File, type: string) => {
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
    } catch (err: any) {
      setError(`Error parsing ${type} file: ${err.message}`);
    }
  };

  const getPersonalInfo = (student: any) => {
    if (!student || !assessmentData) return [];
    
    const personalInfo: any[] = [];
    const headers = assessmentData.headers;
    
    // Find where question columns start (looking for column "1")
    const questionStartIndex = headers.findIndex((h: string) => h === '1');
    
    // Get all columns before the questions
    const personalColumns = questionStartIndex > 0 ? headers.slice(0, questionStartIndex) : headers.slice(0, 10);
    
    personalColumns.forEach((column: string) => {
      personalInfo.push({
        field: column,
        value: student[column] !== undefined ? student[column] : 'N/A'
      });
    });
    
    return personalInfo;
  };

  const calculateDetailedScaleAnalysis = (student: any) => {
    if (!student || !lookupData || !assessmentData) return [];

    // Find all the relevant rows in lookup data
    const strandNameRow = lookupData.data.find((row: any) => row['Question number'] === 'Strand name');
    const difficultyRow = lookupData.data.find((row: any) => row['Question number'] === 'Question difficulty');
    const percentageCorrectRow = lookupData.data.find((row: any) => row['Question number'] === 'Percentage correct');
    
    if (!strandNameRow || !difficultyRow || !percentageCorrectRow) return [];

    const scaleData: any = {};
    
    // Get question numbers (columns 1-40)
    const questionColumns = assessmentData.headers.filter((h: string) => /^\d+$/.test(h));
    
    questionColumns.forEach((questionNum: string) => {
      const strandName = strandNameRow[questionNum];
      const difficulty = difficultyRow[questionNum];
      const percentageCorrect = percentageCorrectRow[questionNum];
      const studentAnswer = student[questionNum];
      
      if (!strandName) return;
      
      // Initialize scale if not exists
      if (!scaleData[strandName]) {
        scaleData[strandName] = [];
      }
      
      // Determine outcome
      let outcome = 'Not attempted';
      let outcomeClass = 'bg-orange-100 text-orange-800';
      
      if (studentAnswer === 1) {
        outcome = 'Correct';
        outcomeClass = 'bg-green-100 text-green-800';
      } else if (studentAnswer !== 'NA' && studentAnswer !== undefined && studentAnswer !== '') {
        outcome = 'Incorrect';
        outcomeClass = 'bg-red-100 text-red-800';
      }
      
      scaleData[strandName].push({
        questionNumber: parseInt(questionNum),
        difficulty: difficulty,
        percentageCorrect: percentageCorrect,
        studentAnswer: studentAnswer,
        outcome: outcome,
        outcomeClass: outcomeClass
      });
    });

    // Convert to array and sort each scale's questions by question number
    return Object.entries(scaleData).map(([scaleName, questions]) => ({
      scale: scaleName,
      questions: questions.sort((a, b) => a.questionNumber - b.questionNumber)
    })).sort((a, b) => a.scale.localeCompare(b.scale));
  };

  const calculateUnattemptedAnalysis = (student: any) => {
    if (!student || !lookupData || !assessmentData) return null;

    // Find the strand name row in lookup data
    const strandNameRow = lookupData.data.find((row: any) => row['Question number'] === 'Strand name');
    
    if (!strandNameRow) return null;

    const unattemptedByScale: any = {};
    let totalUnattempted = 0;
    let totalQuestions = 0;
    
    // Get question numbers (columns 1-40)
    const questionColumns = assessmentData.headers.filter((h: string) => /^\d+$/.test(h));
    
    questionColumns.forEach((questionNum: string) => {
      const strandName = strandNameRow[questionNum];
      const studentAnswer = student[questionNum];
      
      if (!strandName) return;
      
      totalQuestions++;
      
      // Initialize scale if not exists
      if (!unattemptedByScale[strandName]) {
        unattemptedByScale[strandName] = {
          count: 0,
          totalInScale: 0
        };
      }
      
      unattemptedByScale[strandName].totalInScale++;
      
      if (studentAnswer === 'NA' || studentAnswer === undefined || studentAnswer === '') {
        unattemptedByScale[strandName].count++;
        totalUnattempted++;
      }
    });

    // Convert to array format with percentages
    const scaleBreakdown = Object.entries(unattemptedByScale)
      .map(([scaleName, data]) => ({
        scale: scaleName,
        count: data.count,
        totalInScale: data.totalInScale,
        percentageOfScale: data.totalInScale > 0 ? 
          ((data.count / data.totalInScale) * 100).toFixed(1) : '0.0',
        percentageOfTotal: totalQuestions > 0 ? 
          ((data.count / totalQuestions) * 100).toFixed(1) : '0.0'
      }))
      .filter((item: any) => item.count > 0) // Only show scales with unattempted questions
      .sort((a, b) => b.count - a.count); // Sort by count descending

    return {
      totalUnattempted,
      totalQuestions,
      overallPercentage: totalQuestions > 0 ? 
        ((totalUnattempted / totalQuestions) * 100).toFixed(1) : '0.0',
      scaleBreakdown
    };
  };

  const calculateScalePerformance = (student: any) => {
    if (!student || !lookupData || !assessmentData) return [];

    // Find the strand row, strand name row, and correct answer row in lookup data
    const strandRow = lookupData.data.find((row: any) => row['Question number'] === 'Strand');
    const strandNameRow = lookupData.data.find((row: any) => row['Question number'] === 'Strand name');
    const correctAnswerRow = lookupData.data.find((row: any) => row['Question number'] === 'Correct Answer');
    
    if (!strandRow || !strandNameRow || !correctAnswerRow) return [];

    const scalePerformance: any = {};
    
    // Get question numbers (columns 1-40)
    const questionColumns = assessmentData.headers.filter((h: string) => /^\d+$/.test(h));
    
    questionColumns.forEach((questionNum: string) => {
      const strand = strandRow[questionNum];
      const strandName = strandNameRow[questionNum];
      const studentAnswer = student[questionNum];
      
      if (!strand || !strandName) return;
      
      // Use the full strand name as the key
      if (!scalePerformance[strandName]) {
        scalePerformance[strandName] = {
          correct: 0,
          incorrect: 0,
          notAttempted: 0,
          total: 0,
          strandCode: strand // Keep the code for reference if needed
        };
      }
      
      scalePerformance[strandName].total++;
      
      if (studentAnswer === 'NA' || studentAnswer === undefined || studentAnswer === '') {
        scalePerformance[strandName].notAttempted++;
      } else if (studentAnswer === 1) {
        scalePerformance[strandName].correct++;
      } else {
        scalePerformance[strandName].incorrect++;
      }
    });

    // Convert to array format with percentages
    return Object.entries(scalePerformance).map(([scaleName, performance]) => {
      const attempted = performance.correct + performance.incorrect;
      const overallPercentage = performance.total > 0 ? 
        ((performance.correct / performance.total) * 100) : 0;
      const attemptedPercentage = attempted > 0 ? 
        ((performance.correct / attempted) * 100) : 0;
      const attemptedRate = performance.total > 0 ? 
        ((attempted / performance.total) * 100) : 0;
      
      return {
        scale: scaleName, // Now this will be the full name like "Abstract", "Kinetic", etc.
        strandCode: performance.strandCode, // Keep the letter code available
        correct: performance.correct,
        incorrect: performance.incorrect,
        notAttempted: performance.notAttempted,
        attempted: attempted,
        total: performance.total,
        overallPercentage: parseFloat(overallPercentage.toFixed(1)),
        attemptedPercentage: parseFloat(attemptedPercentage.toFixed(1)),
        attemptedRate: parseFloat(attemptedRate.toFixed(1))
      };
    }).sort((a, b) => a.scale.localeCompare(b.scale));
  };

  const handleStudentSelect = (studentId: string) => {
    if (!studentId || !assessmentData) {
      setSelectedStudent(null);
      setSortConfig({});
      return;
    }

    const student = assessmentData.data.find((s: any) => s['Unique ID'] == studentId);
    setSelectedStudent(student);
    setSortConfig({}); // Reset sorting when changing students
  };

  const handleDragOver = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: true }));
  };

  const handleDragLeave = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: false }));
  };

  const handleDrop = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: false }));
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        handleFileUpload(file, type);
      } else {
        setError('Please upload a CSV file');
      }
    }
  };

  const handleSort = (scaleName: string, column: string) => {
    const currentSort = sortConfig[scaleName];
    let direction = 'asc';
    
    if (currentSort && currentSort.column === column && currentSort.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig((prev: any) => ({
      ...prev,
      [scaleName]: { column, direction }
    }));
  };

  const getSortedQuestions = (questions: any[], scaleName: string) => {
    const currentSort = sortConfig[scaleName];
    
    if (!currentSort) return questions;
    
    const { column, direction } = currentSort;
    
    return [...questions].sort((a, b) => {
      let aVal, bVal;
      
      switch (column) {
        case 'scaleItem':
          aVal = questions.indexOf(a) + 1;
          bVal = questions.indexOf(b) + 1;
          break;
        case 'questionNumber':
          aVal = a.questionNumber;
          bVal = b.questionNumber;
          break;
        case 'difficulty':
          aVal = parseFloat(a.difficulty) || 0;
          bVal = parseFloat(b.difficulty) || 0;
          break;
        case 'percentageCorrect':
          aVal = parseFloat(a.percentageCorrect) || 0;
          bVal = parseFloat(b.percentageCorrect) || 0;
          break;
        case 'outcome':
          aVal = a.outcome;
          bVal = b.outcome;
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        default:
          return 0;
      }
      
      if (direction === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });
  };

  const SortableHeader = ({ scaleName, column, children, className = '' }: { scaleName: string; column: string; children: React.ReactNode; className?: string }) => {
    const currentSort = sortConfig[scaleName];
    const isActive = currentSort && currentSort.column === column;
    const direction = isActive ? currentSort.direction : null;
    
    return (
      <th 
        className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
        onClick={() => handleSort(scaleName, column)}
      >
        <div className="flex items-center gap-1">
          {children}
          <div className="flex flex-col">
            <ChevronUp className={`h-3 w-3 ${isActive && direction === 'asc' ? 'text-blue-600' : 'text-gray-300'}`} />
            <ChevronDown className={`h-3 w-3 -mt-1 ${isActive && direction === 'desc' ? 'text-blue-600' : 'text-gray-300'}`} />
          </div>
        </div>
      </th>
    );
  };

  const personalInfo = selectedStudent ? getPersonalInfo(selectedStudent) : [];
  const scalePerformance = selectedStudent ? calculateScalePerformance(selectedStudent) : [];
  const unattemptedAnalysis = selectedStudent ? calculateUnattemptedAnalysis(selectedStudent) : null;
  const detailedScaleAnalysis = selectedStudent ? calculateDetailedScaleAnalysis(selectedStudent) : [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <BarChart3 className="text-blue-600" />
              Assessment Data Analyser
            </h1>
            <p className="text-gray-600 mb-2">
              Upload assessment results and lookup table to analyse student performance by scale
            </p>
            <p className="text-sm text-blue-700 bg-blue-50 rounded-md p-3 border border-blue-200">
              <strong>Focus:</strong> This analyser is specifically designed for students with incomplete assessments. 
              It analyses patterns in missing data and performance across cognitive scales for students who did not complete the full assessment.
            </p>
          </div>

          {/* File Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div 
              className={`border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer ${
                dragOver.assessment 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-blue-400'
              }`}
              onDragOver={(e) => handleDragOver(e, 'assessment')}
              onDragLeave={(e) => handleDragLeave(e, 'assessment')}
              onDrop={(e) => handleDrop(e, 'assessment')}
              onClick={() => assessmentFileRef.current?.click()}
            >
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-4" />
                <label className="block text-sm font-medium text-gray-700 mb-2 cursor-pointer">
                  Assessment Results CSV
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Drag & drop or click to upload
                </p>
                <input
                  ref={assessmentFileRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'assessment');
                  }}
                  className="hidden"
                />
                {assessmentData && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ Loaded {assessmentData.data.length} students
                  </p>
                )}
              </div>
            </div>

            <div 
              className={`border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer ${
                dragOver.lookup 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-blue-400'
              }`}
              onDragOver={(e) => handleDragOver(e, 'lookup')}
              onDragLeave={(e) => handleDragLeave(e, 'lookup')}
              onDrop={(e) => handleDrop(e, 'lookup')}
              onClick={() => lookupFileRef.current?.click()}
            >
              <div className="text-center">
                <FileText className="mx-auto h-8 w-8 text-gray-400 mb-4" />
                <label className="block text-sm font-medium text-gray-700 mb-2 cursor-pointer">
                  Lookup Table CSV
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Drag & drop or click to upload
                </p>
                <input
                  ref={lookupFileRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'lookup');
                  }}
                  className="hidden"
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
                  setSortConfig({});
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
            <div className="space-y-8">
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
                  <div className="space-y-6">
                    {scalePerformance.map((scale, i) => (
                      <div key={i} className="bg-white rounded-md p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">Scale {scale.scale}</h4>
                            <div className="text-sm text-gray-600 mt-1">
                              Correct: {scale.correct}/{scale.total} • Attempted: {scale.attempted}/{scale.total}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">{scale.overallPercentage}%</div>
                            <div className="text-sm text-green-600 font-medium">
                              {scale.attemptedPercentage}% of attempted
                            </div>
                          </div>
                        </div>
                        
                        {/* Dual Bar Visualization */}
                        <div className="space-y-2">
                          {/* Top bar - Correct/Incorrect of Attempted (only spans attempted width) */}
                          <div className="relative h-3">
                            <div className="absolute top-0 left-0 h-3 bg-gray-100 rounded-full overflow-hidden"
                                 style={{ width: `${scale.attemptedRate}%` }}>
                              {scale.attempted > 0 && (
                                <>
                                  {/* Green for correct */}
                                  <div className="h-full bg-green-500 float-left"
                                       style={{ width: `${(scale.correct / scale.attempted) * 100}%` }} />
                                  {/* Red for incorrect */}
                                  <div className="h-full bg-red-500 float-left"
                                       style={{ width: `${(scale.incorrect / scale.attempted) * 100}%` }} />
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Bottom bar - Attempted/Not Attempted (full width) */}
                          <div className="relative h-4">
                            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                              {/* Blue for attempted */}
                              <div className={`bg-blue-500 h-4 float-left transition-all duration-300 ${
                                scale.attemptedRate < 100 ? 'rounded-r-full' : ''
                              }`}
                                   style={{ width: `${scale.attemptedRate}%` }} />
                              {/* Grey remains for not attempted */}
                            </div>
                          </div>
                          
                          {/* Legend */}
                          <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                                Correct ({scale.correct})
                              </span>
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                                Incorrect ({scale.incorrect})
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                                Attempted ({scale.attempted})
                              </span>
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-gray-200 rounded-sm"></div>
                                Not Attempted ({scale.notAttempted})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Unattempted Questions Analysis */}
              {unattemptedAnalysis && unattemptedAnalysis.totalUnattempted > 0 && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Unattempted Questions Analysis</h3>
                  
                  {/* Overall Summary */}
                  <div className="bg-orange-50 border border-orange-200 rounded-md p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-orange-800">
                          {unattemptedAnalysis.totalUnattempted} Questions Not Attempted
                        </h4>
                        <p className="text-orange-700">
                          {unattemptedAnalysis.overallPercentage}% of total assessment ({unattemptedAnalysis.totalUnattempted}/{unattemptedAnalysis.totalQuestions} questions)
                        </p>
                      </div>
                      <div className="text-3xl font-bold text-orange-600">
                        {unattemptedAnalysis.overallPercentage}%
                      </div>
                    </div>
                  </div>

                  {/* Scale Breakdown */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900 mb-3">Breakdown by Scale</h4>
                    {unattemptedAnalysis.scaleBreakdown.map((item, i) => (
                      <div key={i} className="bg-white rounded-md p-4 shadow-sm border-l-4 border-orange-400">
                        <div className="flex justify-between items-center">
                          <div>
                            <h5 className="font-medium text-gray-900">Scale {item.scale}</h5>
                            <p className="text-sm text-gray-600">
                              {item.count} of {item.totalInScale} questions in this scale
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-orange-600">{item.percentageOfScale}%</div>
                            <div className="text-sm text-gray-500">of this scale</div>
                          </div>
                        </div>
                        
                        {/* Progress bar showing unattempted portion */}
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div className="bg-orange-400 h-3 rounded-full"
                                 style={{ width: `${item.percentageOfScale}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>Unattempted: {item.count}</span>
                            <span>Total in scale: {item.totalInScale}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Scale Analysis */}
              {detailedScaleAnalysis.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Question Analysis by Scale</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Shows difficulty level, success rate, and student performance for each question within each scale. 
                    <span className="font-medium text-blue-600"> Click column headers to sort.</span>
                  </p>
                  
                  <div className="space-y-8">
                    {detailedScaleAnalysis.map((scaleData, scaleIndex) => (
                      <div key={scaleIndex} className="bg-white rounded-lg p-6 shadow-sm">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Scale {scaleData.scale}</h4>
                        
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <SortableHeader scaleName={scaleData.scale} column="scaleItem">
                                  Scale Item #
                                </SortableHeader>
                                <SortableHeader scaleName={scaleData.scale} column="questionNumber">
                                  Question #
                                </SortableHeader>
                                <SortableHeader scaleName={scaleData.scale} column="difficulty">
                                  Difficulty
                                </SortableHeader>
                                <SortableHeader scaleName={scaleData.scale} column="percentageCorrect">
                                  % Correct
                                </SortableHeader>
                                <SortableHeader scaleName={scaleData.scale} column="outcome">
                                  Outcome
                                </SortableHeader>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {getSortedQuestions(scaleData.questions, scaleData.scale).map((question, questionIndex) => {
                                // Calculate the original index for scale item number
                                const originalIndex = scaleData.questions.indexOf(question);
                                return (
                                  <tr key={questionIndex} className={`${question.outcomeClass} hover:opacity-75 transition-opacity`}>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                      {originalIndex + 1}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                      {question.questionNumber}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                      {question.difficulty}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                      {question.percentageCorrect}%
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium">
                                      <span className={`px-2 py-1 rounded-full text-xs ${
                                        question.outcome === 'Correct' ? 'bg-green-200 text-green-800' :
                                        question.outcome === 'Incorrect' ? 'bg-red-200 text-red-800' :
                                        'bg-orange-200 text-orange-800'
                                      }`}>
                                        {question.outcome}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Quick stats for this scale */}
                        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                          <div className="bg-green-50 rounded-md p-3">
                            <div className="text-sm font-medium text-green-800">Correct</div>
                            <div className="text-lg font-bold text-green-600">
                              {scaleData.questions.filter((q: any) => q.outcome === 'Correct').length}
                            </div>
                          </div>
                          <div className="bg-red-50 rounded-md p-3">
                            <div className="text-sm font-medium text-red-800">Incorrect</div>
                            <div className="text-lg font-bold text-red-600">
                              {scaleData.questions.filter((q: any) => q.outcome === 'Incorrect').length}
                            </div>
                          </div>
                          <div className="bg-orange-50 rounded-md p-3">
                            <div className="text-sm font-medium text-orange-800">Not Attempted</div>
                            <div className="text-lg font-bold text-orange-600">
                              {scaleData.questions.filter((q: any) => q.outcome === 'Not attempted').length}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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