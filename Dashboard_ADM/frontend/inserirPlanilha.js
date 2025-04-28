
    const form = document.getElementById('uploadForm');

    const processButton = document.getElementById('processButton');
    const fileNameDisplay = document.getElementById('fileName');
    const feedbackDiv = document.getElementById('uploadFeedback');


    document.getElementById('fileInput').addEventListener('change', function() {
        console.log("Funcionou!", this.files);
      });


    
