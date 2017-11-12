// Copyright (C) 2017 Nokia

import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs/Observable";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {catchError, map} from "rxjs/operators";
import {ErrorObservable} from "rxjs/observable/ErrorObservable";
import {of as ObservableOf} from "rxjs/observable/of";

import {Execution, TaskExec, WorkflowDef, TaskDef, ActionExecution, SubWorkflowExecution} from "../../shared/models";
import {toUrlParams} from "../../shared/utils";

@Injectable()
export class MistralService {
    protected prefix = "api/";

    selectedExecution = new BehaviorSubject<Execution>(null);
    selectedExecutionTasks = new BehaviorSubject<TaskExec[]>(null);
    selectedTask = new BehaviorSubject<{task: TaskExec, taskDef: TaskDef}>(null);

    constructor(protected http: HttpClient) {
    }

    handleError(e) {
        console.error(e);
        return ErrorObservable.create(e);
    }

    /**
     * url: /executions?<query_params>
     */
    executions(sortBy="created_at", sortByDir="desc"): Observable<Execution[]> { /*tslint:disable-line*/
        const params = toUrlParams({
            limit: 1000,
            fields: "workflow_name,created_at,state,task_execution_id",
            sort_keys: `${sortBy},name`,
            sort_dirs: `${sortByDir}`
        });

        return this.http.get(this.prefix + "executions", {params})
            .pipe(
                map(res => res["executions"]),
                catchError(e => this.handleError(e))
            );
    }

    /**
     * url: /executions/<id>
     */
    execution(id: string): Observable<Execution> {
        return this.http.get(this.prefix + "executions/" + id)
            .pipe(
                map((res: Execution) => {
                    const execution = new Execution(res);
                    this.selectedExecution.next(execution);
                    return execution;
                }),
                catchError(e => this.handleError(e))
            );
    }

    /**
     * url: /executions/<id>/tasks
     */
    executionTasks(id: string): Observable<TaskExec[]> {
        const fields = ["state_info", "created_at", "name", "runtime_context", "workflow_name", "state",
            "updated_at", "workflow_execution_id", "workflow_id", "type"].join(",");
        const params = toUrlParams({fields});

        return this.http.get(this.prefix + `executions/${id}/tasks`, {params})
            .pipe(
                map(res => res["tasks"]),
                map(res => {
                    const tasks = res.map(task => new TaskExec(task));
                    this.selectedExecutionTasks.next(tasks);
                    return tasks;
                }),
                catchError(e => this.handleError(e))
            );
    }

    /**
     * url: /workflows/<id>
     * Extract the definition
     */
    workflowDef(id: string): Observable<WorkflowDef> {
        return this.http.get(this.prefix + `workflows/${id}`)
            .pipe(
                map(res => new WorkflowDef(res["definition"], res["name"])),
                catchError(e => this.handleError(e))
            );
    }

    setParentExecutionId(execution: Execution): void {
        if (execution.task_execution_id) {
            this.http.get(this.prefix + `tasks/${execution.task_execution_id}`)
                .pipe(
                    map((res: TaskExec) => execution.parentExecutionId = res.workflow_execution_id),
                    catchError(e => this.handleError(e))
                )
                .subscribe(() => {});

        }
    }

    /**
     * url: /tasks/<taskExecId>
     * This call will patch the "missing" 'result' value on a task execution.
     */
    patchTaskExecutionData(taskExec: TaskExec) {
        if (taskExec.result != null) {
            return ObservableOf(taskExec);
        } else {
            return this.http.get(this.prefix + `tasks/${taskExec.id}`)
                .pipe(
                    map(res => {
                        taskExec.setResult(res["result"]);
                        taskExec.setPublished(res["published"]);
                        return taskExec;
                    }),
                    catchError(e => this.handleError(e))
                );
        }
    }

    /**
     * url: /actions_executions/<action_execution_id>
     * This call will patch the missing 'output' value on task action execution
     */
    patchActionExecutionOutput(actionExecution: ActionExecution) {
        if (actionExecution.output != null) {
            return ObservableOf(actionExecution);
        } else {
            return this.http.get(this.prefix + `action_executions/${actionExecution.id}`)
                .pipe(
                    map(res => {
                        actionExecution.input = res["input"];
                        actionExecution.output = res["output"];
                    }),
                    catchError(e => this.handleError(e))
                );
        }
    }

    /**
     * This call will patch the missing 'output' value on sub-workflow execution.
     */
    patchSubWorfklowExecutionOutput(subWfExecution: SubWorkflowExecution) {
        if (subWfExecution.output != null) {
            return ObservableOf(subWfExecution);
        } else {
            return this.execution(subWfExecution.id)
                .pipe(
                    map(execution => {
                        subWfExecution.input = execution.input;
                        subWfExecution.output = execution.output;
                    }),
                    catchError(e => this.handleError(e))
                );
        }
    }

    /**
     * url: /tasks/<taskExecutionId>/action_executions
     */
    actionExecutions(taskExecId: string): Observable<ActionExecution[]> {
        const params = toUrlParams({fields: "name,state"});
        return this.http.get(this.prefix + `tasks/${taskExecId}/action_executions`, {params})
            .pipe(
                map(res => res["action_executions"]),
                catchError(e => this.handleError(e))
            );
    }

    /**
     * url: /executions/?task_execution_id=<id>
     * retrieve the sub-workflow execution details
     */
    wfExecutionsByTaskExecutionId(taskExecId: string): Observable<any[]> {
        const params = toUrlParams({task_execution_id: taskExecId, fields: "state,workflow_name"});
        return this.http.get(this.prefix + "executions", {params})
            .pipe(
                map(res => res["executions"]),
                catchError(e => this.handleError(e))
            );
    }
}
