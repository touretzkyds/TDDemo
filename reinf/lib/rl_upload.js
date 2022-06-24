function assert(condition, message) {
    // from http://stackoverflow.com/questions/15313418/javascript-assert
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
    }
}

function getopt(opt, field_name, default_value) {
    if (typeof opt == 'undefined') { 
        return default_value; 
    }
    return (typeof opt[field_name] != 'undefined') ? opt[field_name] : default_value;
}

function zeros(n) {
    if (typeof(n) == 'undefined' || isNaN(n)) {
         return []; 
    }
    if (typeof ArrayBuffer == 'undefined') {
    // lacking browser support
        var arr = new Array(n);
        for (var i = 0; i < n; i ++) {
            arr[i] = 0; 
        }
        return arr;
    } else {
        return new Float64Array(n);
    }
}

function randi(a, b) {
    return Math.floor(Math.random() * (b - a) + a); 
}

function setConst(arr, c) {
    for (var i = 0; i < arr.length; i ++) {
        arr[i] = c;
    }
}

function sampleWeighted(p) {
    var r = Math.random();
    var c = 0.0;
    for (var i = 0; i < p.length; i ++) {
        c += p[i];
        if (c >= r) { 
            return i; 
        }
    }
    assert(false, 'wtf');
}

var upload_complete = 0;
var contents;
const readUploadedFileAsText = (inputFile) => {
    const temporaryFileReader = new FileReader();
  
    return new Promise((resolve, reject) => {
        temporaryFileReader.onerror = () => {
            temporaryFileReader.abort();
            reject(new DOMException("Problem parsing input file."));
        };
    
        temporaryFileReader.onload = () => {
            resolve(temporaryFileReader.result);
        };
        temporaryFileReader.readAsText(inputFile);
    });
};
  
  const handleUpload = async (event) => {
    const file = event.target.files[0];
    const fileContentDiv = document.querySelector('div#file-content')
  
    try {
        const fileContents = await readUploadedFileAsText(file)  
        contents = fileContents
        upload_complete = 1;
        console.log(contents)
        fileContentDiv.innerHTML = fileContents
    } catch (e) {
        fileContentDiv.innerHTML = e.message
    }
}
  
class Environment{
    constructor() {
        this.lines = null;
        this.wh = null;
        this.Exits = null;
        this.Rarr = null; // reward array
        this.T = null; // cell types, 0 = normal, 1 = cliff
        document.querySelector('input#primary-file-upload').addEventListener('change', handleUpload)
        if (upload_complete == 0) {
            this.example();
        } else {
            this.reset();
        }   
    }
    reset() {
        console.log(contents)
        this.lines = contents.split(/\r?\n/);
        console.log(this.lines)
        if (this.lines.length != 4) {
            assert(false, 'Invalid Input');
        }
        this.wh = this.lines[0].split(' ');
        for (var i = 0; i < this.wh.length; i ++) {
            this.wh[i] = parseInt(this.wh[i]);
        }
        
        this.Exits = this.lines[1].split(' ');
        for (var i = 0; i < this.Exits.length; i ++) {
            this.Exits[i] = parseInt(this.Exits[i]);
        }
        this.Rarr = this.lines[2].split(' ');
        for (var i = 0; i < this.Rarr.length; i ++) {
            this.Rarr[i] = parseInt(this.Rarr[i]);
        }
        this.T = this.lines[3].split(' ');
        for (var i = 0; i < this.T.length; i ++) {
            this.T[i] = parseInt(this.T[i]);
        }
        this.gw = this.wh[0];
        this.gh = this.wh[1];
        this.gs = this.gh * this.gw;
    }
    example() {
        // hardcoding one gridworld for now
        this.gh = 5;
        this.gw = 4;
        this.gs = this.gh * this.gw; // number of states
        // specify some rewards
        var Rarr = zeros(this.gs);
        var T = zeros(this.gs);
        var Exits = zeros(this.gs);
        this.rewardSpot = 15;
        Rarr[this.rewardSpot] = 1;
        Exits[this.rewardSpot] = 1;

        // make some cliffs
        T[1*this.gh] = 1;
        T[1*this.gh+1] = 1;
        T[1*this.gh+2] = 1;
        T[1*this.gh+3] = 1;

        T[3*this.gh+1] = 1;
        T[3*this.gh+2] = 1;
        T[3*this.gh+3] = 1;
        T[3*this.gh+4] = 1;
        this.Exits = Exits;
        this.Rarr = Rarr;
        this.T = T;
    }
    reward(s) {
        // reward of being in s, taking action a, and ending up in ns
        return this.Rarr[s];
    }
    getNextState(s, a) {
        // given (s,a) return distribution over s' (in sparse form)
        if(this.T[s] == 1) {
            // cliff! oh no!
        } else if(this.Exits[s] == 1) {
            // agent wins! teleport to start
            var ns = this.startState();
        } else {
        // ordinary space
            var nx, ny;
            var x = this.stox(s);
            var y = this.stoy(s);
            if(a == 0) {nx = x - 1; ny = y;}
            if(a == 1) {nx = x; ny = y - 1;}
            if(a == 2) {nx = x; ny = y + 1;}
            if(a == 3) {nx = x + 1; ny = y;}
            var ns = nx * this.gh + ny;
            //if(this.T[ns] == 1) {
                // actually never mind, this is a wall. reset the agent
                //var ns = s;
            //}
        }
        // gridworld is deterministic, so return only a single next state
        return ns;
    }
    getLearnReward(s, a) {
        // gridworld is deterministic, so this is easy
        var ns = this.getNextState(s,a);
        var r = this.Rarr[s]; // observe the raw reward of being in s, taking a, and ending up in ns
        r -= 0.01; // every step takes a bit of negative reward
        var out = {'ns': ns, 'rval': r};
        if(this.Exits[s] == 1 && ns == 0) {
            // episode is over
            //out.rval += this.Rarr[s];
            out.reset_episode = true;
        }
        return out;
    }
    allowedActions(s) {
        var x = this.stox(s);
        var y = this.stoy(s);
        var as = [];
        if(x > 0 && this.T[this.xytos(x - 1, y)] != 1) { as.push(0); }
        if(y > 0 && this.T[this.xytos(x, y - 1)] != 1) { as.push(1); }
        if(y < this.gh-1 && this.T[this.xytos(x, y + 1)] != 1) { as.push(2); }
        if(x < this.gw-1 && this.T[this.xytos(x + 1, y)] != 1) { as.push(3); }
        return as;
    }
    randomState() { return Math.floor(Math.random()*this.gs); }
    startState() { return 0; }
    getNumStates() { return this.gs; }
    getMaxNumActions() { return 4; }

    // private functions
    stox(s) { return Math.floor(s/this.gh); }
    stoy(s) { return s % this.gh; }
    xytos(x,y) { return x * this.gh + y; }
}

class TDAgent{
    constructor(env, opt) {
        this.update = getopt(opt, 'update', 'qlearn'); // qlearn | sarsa
        this.gamma = getopt(opt, 'gamma', 0.75); // future reward discount factor
        this.epsilon = getopt(opt, 'epsilon', 0.1); // for epsilon-greedy policy
        this.alpha = getopt(opt, 'alpha', 0.01); // value function learning rate
        // class allows non-deterministic policy, and smoothly regressing towards the optimal policy based on Q
        this.smooth_policy_update = getopt(opt, 'smooth_policy_update', false);
        this.beta = getopt(opt, 'beta', 0.01); // learning rate for policy, if smooth updates are on
        this.q_init_val = getopt(opt, 'q_init_val', 0); // optional optimistic initial values
        this.planN = getopt(opt, 'planN', 0); // number of planning steps per learning iteration (0 = no planning)
        this.Q = null; // state action value function
        this.P = null; // policy distribution \pi(s,a)
        this.env_model_s = null;; // environment model (s,a) -> (s',r)
        this.env_model_r = null;; // environment model (s,a) -> (s',r)
        this.env = env; // store pointer to environment
        this.reset();
    }
    reset(){
        // reset the agent's policy and value function
        this.numStates = this.env.getNumStates();
        this.numActs = this.env.getMaxNumActions();
        this.Q = zeros(this.numStates * this.numActs);
        if (this.q_init_val != 0) { 
            setConst(this.Q, this.q_init_val); 
        }
        this.P = zeros(this.numStates * this.numActs);
        // model/planning vars
        this.env_model_s = zeros(this.numStates * this.numActs);
        setConst(this.env_model_s, -1); // init to -1 so we can test if we saw the state before
        this.env_model_r = zeros(this.numStates * this.numActs);
        this.sa_seen = [];
        this.pq = zeros(this.numStates * this.numActs);

        // initialize uniform random policy
        for (var s = 0; s < this.numStates;s ++) {
            var poss = this.env.allowedActions(s);
            for (var i = 0; i < poss.length; i ++) {
                if (this.env.Exits[s] == 1) {
                    this.P[poss[i] * this.numStates + s] = 0;
                } else {
                    this.P[poss[i] * this.numStates + s] = 1.0 / poss.length;
                }
            }
        }
        // agent memory, needed for streaming updates
        // (s0,a0,r0,s1,a1,r1,...)
        this.r0 = null;
        this.s0 = null;
        this.s1 = null;
        this.a0 = null;
        this.a1 = null;
    }
    resetEpisode() {
        // an episode finished
    }
    getAction(s){
        // act according to epsilon greedy policy
        var poss = this.env.allowedActions(s);
        //if (this.env.Exits[s] == 1) {
            //var a = -1;
        //} else {
            var probs = [];
            for (var i = 0; i < poss.length; i ++) {
                probs.push(this.P[poss[i] * this.numStates + s]);
            }
            // epsilon greedy policy
            if (Math.random() < this.epsilon) {
                var a = poss[randi(0, poss.length)]; // random available action
            } else {
                var a = poss[sampleWeighted(probs)];
            }
        //}
        // shift state memory
        this.s0 = this.s1;
        this.a0 = this.a1;
        this.s1 = s;
        this.a1 = a;
        return a;
    }
    learn(r1){
        // takes reward for previous action, which came from a call to act()
        if (this.r0 != null) {
            this.learnFromTuple(this.s0, this.a0, this.r0, this.s1);
            if (this.planN > 0) {
                this.updateModel(this.s0, this.a0, this.r0, this.s1);
                this.plan();
            }
        }
        this.r0 = r1; // store this for next update
    }
    updateModel(s0, a0, r0, s1) {
        // transition (s0,a0) -> (r0,s1) was observed. Update environment model
        var sa = a0 * this.numStates + s0;
        if (this.env_model_s[sa] == -1) {
            // first time we see this state action
            this.sa_seen.push(a0 * this.numStates + s0); // add as seen state
        }
        this.env_model_s[sa] = s1;
        this.env_model_r[sa] = r0;
    }
    plan() {

        // order the states based on current priority queue information
        var spq = [];
        for (var i = 0; i < this.sa_seen.length; i ++) {
            var sa = this.sa_seen[i];
            var sap = this.pq[sa];
            if (sap > 1e-5) { // gain a bit of efficiency
                spq.push({sa: sa, p: sap});
            }
        }
        spq.sort(function(a,b){ return a.p < b.p ? 1 : -1});

        // perform the updates
        var nsteps = Math.min(this.planN, spq.length);
        for (var k = 0; k < nsteps; k ++) {       
            var s0a0 = spq[k].sa;
            this.pq[s0a0] = 0; // erase priority, since we're backing up this state
            var s0 = s0a0 % this.numStates;
            var a0 = Math.floor(s0a0 / this.numStates);
            var r0 = this.env_model_r[s0a0];
            var s1 = this.env_model_s[s0a0];
            this.learnFromTuple(s0, a0, r0, s1); 
        }
    }
    learnFromTuple(s0, a0, r0, s1) {
        var sa = a0 * this.numStates + s0;
        // calculate the target for Q(s,a)
        if (this.update == 'qlearn') {
            // Q learning target is Q(s0,a0) = r0 + gamma * max_a Q[s1,a]
            var poss = this.env.allowedActions(s1);
            if (this.env.Rarr[s0] != 0) {
                var target = this.env.Rarr[s0];
            } else {
                var qmax = 0;
                for (var i = 0; i < poss.length; i ++) {
                    var s1a = poss[i] * this.numStates + s1;
                    var qval = this.Q[s1a];
                    if (i == 0 || qval > qmax) { 
                        qmax = qval; 
                    }
                }
                var target = r0 + this.gamma * qmax;
            }
        }
        // simpler and faster update without eligibility trace
        // update Q[sa] towards it with some step size
        var update = this.alpha * (target - this.Q[sa]);
        this.Q[sa] += update;
        this.updatePriority(s0, update);
        // update the policy to reflect the change (if appropriate)
        this.updatePolicy(s0);
    }
    updatePriority(s, u) {
        // used in planning. Invoked when Q[sa] += update
        // we should find all states that lead to (s,a) and upgrade their priority
        // of being update in the next planning step
        u = Math.abs(u);
        if (u < 1e-5 || this.planN == 0) { 
            return; 
        } // for efficiency skip small updates.
        for (var si = 0; si < this.numStates; si ++) {
        // note we are also iterating over impossible actions at all states,
        // but this should be okay because their env_model_s should simply be -1
        // as initialized, so they will never be predicted to point to any state
        // because they will never be observed, and hence never be added to the model
            for (var ai = 0; ai < this.numActs; ai ++) {
                var siai = ai * this.numStates + si;
                if (this.env_model_s[siai] == s) {
                    // this state leads to s, add it to priority queue
                    this.pq[siai] += u;
                }
            }
        }
    }
    updatePolicy(s) {
        var poss = this.env.allowedActions(s);
        // set policy at s to be the action that achieves max_a Q(s,a)
        // first find the maxy Q values
        if (this.env.Exits[s] == 1) {
            return;
        }
        var qmax, nmax;
        var qs = [];
        for (var i = 0; i < poss.length; i ++) {
            var a = poss[i];
            var qval = this.Q[a * this.numStates + s];
            qs.push(qval);
            if (i == 0 || qval > qmax) { 
                qmax = qval; 
                nmax = 1; 
            }
            else if (qval == qmax) { 
                nmax += 1; 
            }
        }
        // now update the policy smoothly towards the argmaxy actions
        var psum = 0.0;
        for (var i = 0; i < poss.length; i ++) {
            var a = poss[i];
            var target = (qs[i] == qmax) ? 1.0 / nmax : 0.0;
            var ix = a * this.numStates + s;
            if (this.smooth_policy_update) {
                // slightly hacky :p
                this.P[ix] += this.beta * (target - this.P[ix]);
                if (this.P[ix] < 0) {
                    console.log("P", this.P[ix], target);
                }
                psum += this.P[ix];
            } else {
                // set hard target
                this.P[ix] = target;
            }
        }
        if (this.smooth_policy_update) {
            // renomalize P if we're using smooth policy updates
            for (var i = 0; i < poss.length; i ++) {
                var a = poss[i];
                this.P[a * this.numStates + s] /= psum;
            }
        }
    }
}