//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4

var stephanie1 = "2755611"
var molly1 = "2755665"
var karen1 = "2755670"
var samantha1 = "2755671"

displayPatientRisk(stephanie1, "pt-1")
displayPatientRisk(molly1, "pt-2")
displayPatientRisk(karen1, "pt-3")
displayPatientRisk(samantha1, "pt-4")

function displayPatientRisk(patientId, ptDisplayNumber){
  var riskScore = 0;
  
  var riskSpots = {
    bmi: ptDisplayNumber + "-info-1",
    famHist: ptDisplayNumber + "-info-2",
    pcos: ptDisplayNumber + "-info-3"
  }
  
  //create a fhir client based on the sandbox enviroment and test paitnet.
  const client = new FHIR.client({
    serverUrl: "http://hapi.fhir.org/baseDstu3/",
    tokenResponse: {
      patient: patientId
    }
  });
  
  // helper function to process fhir resource to get the patient name.
  function getPatientName(pt) {
    if (pt.name) {
      var names = pt.name.map(function(name) {
        return name.given.join(" ") + " " + name.family;
      });
      return names.join(" / ")
    } else {
      return "anonymous";
    }
  }
  
  function displayRisk(risk, spot) {
    riskScore += 1
    document.getElementById(ptDisplayNumber + "-risk").innerHTML = "Risk Score: " + riskScore + " / 3"
    document.getElementById(spot).innerHTML = risk;
    document.getElementById(spot).className = 'high-risk'
  }
  
  function displayLowRisk(risk, spot) {
    document.getElementById(ptDisplayNumber + "-risk").innerHTML = "Risk Score: " + riskScore + " / 3"
    document.getElementById(spot).innerHTML =  risk;
    document.getElementById(spot).className = 'low-risk'
  }
  
  // create a patient object to initalize the patient
  function defaultPatient() {
    return {
      height: {
        value: ''
      },
      weight: {
        value: ''
      },
    };
  }
  
  // get patient object and then display its demographics info in the banner
  client.request(`Patient/${client.patient.id}`).then(
    function(patient) {
      document.getElementById(ptDisplayNumber + '-name').innerHTML = getPatientName(patient)
    }
  );
  
  // CALCULATE BMI
  var query = new URLSearchParams()
  query.set("patient", client.patient.id);
  query.set("_count", 100);
  query.set("_sort", "-date");
  query.set("code", [
    //height:
    'http://loinc.org|8302-2',
    //weight:
    'http://loinc.org|29463-7'
  ].join(","));
  
  
  client.request("Observation?" + query, {
    pageLimit: 0,
    flat: true
  }).then(
    function(ob) {
  
      // group all of the observation resoruces by type into their own
      var byCodes = client.byCodes(ob, 'code');
      var height = byCodes('8302-2');
      var weight = byCodes('29463-7');
  
      // create patient object
      var p = defaultPatient();
  
      if (typeof height == 'undefined' || typeof weight == 'undefined'){
        //TODO: make box say "cannot calculate BMI"
      }else{
        // go through some common units for weight, convert to kg
        var weightUnits = weight[0].valueQuantity.unit
        var weightNumber = weight[0].valueQuantity.value
        let weightInKg
  
        switch (weightUnits){
          case "kgs":
            weightInKg = weightNumber
            break
          case "lbs":
            weightInKg = weightNumber * 0.453592
            break
          default:
            //TODO: cannot calculate
        }
        
        //console.log(weight[0].valueQuantity.value.toFixed(3).toString() + ' ' + weight[0].valueQuantity.unit);
  
        // go through some common units for height, convert to m
        var heightUnits = height[0].valueQuantity.unit
        var heightNumber = height[0].valueQuantity.value
        let heightInM = 0
  
        switch (heightUnits){
          case "cm":
            heightInM = heightNumber / 100
            break
          case "m":
            heightInM = heightNumber 
            break
          case "in":
            heightInM = heightNumber / 39.37
          default:
            //TODO: cannot calculate
        }
  
        //console.log(height[0].valueQuantity.value.toFixed(3).toString() + ' ' + height[0].valueQuantity.unit);
      
        // calculate BMI = kg/(m^2)
        var bmi = (weightInKg / (heightInM * heightInM)).toFixed(2)
        // console.log("BMI: " + bmi)
        // console.log("h: " + heightInM)
        // console.log("w: " + weightInKg)
  
        // if BMI > 30, display risk
        if (bmi > 30){
          displayRisk("BMI: " + bmi, riskSpots.bmi)
        } else {
          displayLowRisk("BMI: " + bmi, riskSpots.bmi)
        }
  
  
      }
    }
  )
  
  // CHECK FOR IMMEDIATE FAMILY HISTORY OF DIABETES 
  
  client.request(`FamilyMemberHistory?patient=${client.patient.id}`, {
      pageLimit: 0,
      flat: true
  }).then(
    function(famHistList) {
      displayLowRisk("No Family History of Diabetes", riskSpots.famHist)
      famHistList.forEach(famHist => {
        
      famHist.condition.forEach(condition => {

        if ((condition.code.coding[0].display).includes("diabetes")){
          displayRisk("Family History of " + condition.code.coding[0].display, riskSpots.famHist)
        }

      })
  
  
      // ADDED ON: if it is an immediate family member
      });
      
  
    }
  )
  
  // CHECK FOR PCOS DIAGNOSIS: SNOMED 237055002
  
    client.request(`Condition?patient=${client.patient.id}&code=237055002`, {
      pageLimit: 0,
      flat: true
    }).then(
      function(condition) {

        if (typeof condition[0] != 'undefined'){
          displayRisk("PCOS Diagnosis", riskSpots.pcos) 
        } else {
          displayLowRisk("No PCOS Diagnosis", riskSpots.pcos)
        }

        // TODO: it's a risk


      }
    )
}



